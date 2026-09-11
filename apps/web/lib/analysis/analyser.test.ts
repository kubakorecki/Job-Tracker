import { describe, expect, it } from "vitest";
import {
  MAX_FEEDBACK_LENGTH,
  MAX_REASON_LENGTH,
  readOutcome,
} from "./analyser";

/**
 * Turning the provider's reply into an outcome. This is the one piece of the
 * Analysis the API seam cannot reach: the endpoint's tests substitute the
 * analyser, so they substitute this away with it. Everything else about a run
 * is asserted through the endpoint.
 *
 * The schema has no way to attach a verdict to the Requirement it is about —
 * a list of objects is the nested shape Gemini rejects — so the pairing is
 * carried by position, and much of this file is about that pairing being read
 * back safely: a reply that has drifted out of step must cost the user a
 * verdict, never put one on the wrong Requirement.
 */

const outcome = (
  coverages: unknown,
  reasons: unknown,
  rating: unknown = 6,
  feedback: unknown = "Do more.",
) => JSON.stringify({ coverages, reasons, rating, feedback });

describe("reading the per-Requirement verdicts", () => {
  it("pairs each verdict with its reason, in the order they were asked", () => {
    const json = outcome(
      ["partial", "missing"],
      ["Four years against the five asked for.", "Not mentioned."],
    );

    expect(readOutcome(json, 2).readings).toEqual([
      {
        index: 0,
        coverage: "partial",
        reason: "Four years against the five asked for.",
      },
      { index: 1, coverage: "missing", reason: "Not mentioned." },
    ]);
  });

  it("drops a verdict that is not one of the three Coverages", () => {
    const json = outcome(
      ["have", "probably"],
      ["Named twice.", "It is hard to say."],
    );

    expect(readOutcome(json, 2).readings).toEqual([
      { index: 0, coverage: "have", reason: "Named twice." },
    ]);
  });

  it("drops a verdict that came with nothing to say for itself", () => {
    // A badge with no line beside it is half an answer, and the line is what
    // tells the user what to change. Leaving the Requirement unread is honest.
    const json = outcome(["have", "missing"], ["Named twice.", "   "]);

    expect(readOutcome(json, 2).readings).toEqual([
      { index: 0, coverage: "have", reason: "Named twice." },
    ]);
  });

  it("leaves a Requirement the reply ran out of answers for unread", () => {
    expect(
      readOutcome(outcome(["have"], ["Named twice."]), 2).readings,
    ).toEqual([{ index: 0, coverage: "have", reason: "Named twice." }]);
  });

  it("ignores a verdict about a Requirement nobody asked about", () => {
    const json = outcome(
      ["partial", "missing"],
      ["Four years against the five asked for.", "Not mentioned."],
    );

    expect(readOutcome(json, 1).readings).toEqual([
      {
        index: 0,
        coverage: "partial",
        reason: "Four years against the five asked for.",
      },
    ]);
  });

  it("keeps a reason to the length of a line", () => {
    const json = outcome(["have"], ["x".repeat(MAX_REASON_LENGTH + 50)]);

    const [reading] = readOutcome(json, 1).readings;
    expect(reading?.reason).toHaveLength(MAX_REASON_LENGTH);
  });

  it("rejects a reply that answered about no Requirement at all", () => {
    // Not an Analysis of nothing: a provider that could not be understood, and
    // the endpoint has a different thing to say about each.
    expect(() => readOutcome(outcome([], []), 2)).toThrow();
  });

  it("rejects a reply whose arrays are not arrays", () => {
    expect(() => readOutcome(outcome("have", "Named twice."), 1)).toThrow();
  });

  it("rejects a reply that is not JSON at all", () => {
    expect(() => readOutcome("not json", 1)).toThrow();
  });
});

describe("reading the rating and feedback", () => {
  it("carries the readings, the rating and the feedback together", () => {
    const json = outcome(
      ["partial", "missing"],
      ["Four years against the five asked for.", "Not mentioned."],
      6,
      "Add a project that names Kubernetes explicitly.",
    );

    expect(readOutcome(json, 2)).toEqual({
      readings: [
        {
          index: 0,
          coverage: "partial",
          reason: "Four years against the five asked for.",
        },
        { index: 1, coverage: "missing", reason: "Not mentioned." },
      ],
      rating: 6,
      feedback: "Add a project that names Kubernetes explicitly.",
    });
  });

  // A bad rating or feedback never costs the readings a reply otherwise got
  // right — only a reply with no readings at all rejects the run.

  it("reads a rating outside 1 to 10 as none given", () => {
    const json = outcome(["have"], ["Named twice."], 0, "Do more.");
    expect(readOutcome(json, 1)).toMatchObject({ rating: null });
  });

  it("reads a rating that is not a whole number as none given", () => {
    const json = outcome(["have"], ["Named twice."], 6.5, "Do more.");
    expect(readOutcome(json, 1)).toMatchObject({ rating: null });
  });

  it("reads feedback with nothing to say as none given", () => {
    const json = outcome(["have"], ["Named twice."], 6, "   ");
    expect(readOutcome(json, 1)).toMatchObject({ feedback: null });
  });

  it("reads a reply with no rating at all as none given", () => {
    const json = JSON.stringify({
      coverages: ["have"],
      reasons: ["Named twice."],
      feedback: "Do more.",
    });
    expect(readOutcome(json, 1)).toMatchObject({ rating: null });
  });

  it("keeps feedback to the length of a paragraph", () => {
    const json = outcome(
      ["have"],
      ["Named twice."],
      6,
      "x".repeat(MAX_FEEDBACK_LENGTH + 50),
    );

    expect(readOutcome(json, 1).feedback).toHaveLength(MAX_FEEDBACK_LENGTH);
  });
});
