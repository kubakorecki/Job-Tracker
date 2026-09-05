import { describe, expect, it } from "vitest";
import { MAX_REASON_LENGTH, readReadings } from "./analyser";

/**
 * Turning the provider's two flat arrays into verdicts. This is the one piece
 * of the Analysis the API seam cannot reach: the endpoint's tests substitute
 * the analyser, so they substitute this away with it. Everything else about a
 * run is asserted through the endpoint.
 *
 * The schema has no way to attach a verdict to the Requirement it is about —
 * a list of objects is the nested shape Gemini rejects — so the pairing is
 * carried by position, and the whole of this file is about that pairing being
 * read back safely: a reply that has drifted out of step must cost the user a
 * verdict, never put one on the wrong Requirement.
 */

const reply = (coverages: unknown, reasons: unknown) =>
  JSON.stringify({ coverages, reasons });

const BOTH = reply(
  ["partial", "missing"],
  ["Four years against the five asked for.", "Not mentioned."],
);

describe("reading a reply", () => {
  it("pairs each verdict with its reason, in the order they were asked", () => {
    expect(readReadings(BOTH, 2)).toEqual([
      {
        index: 0,
        coverage: "partial",
        reason: "Four years against the five asked for.",
      },
      { index: 1, coverage: "missing", reason: "Not mentioned." },
    ]);
  });

  it("drops a verdict that is not one of the three Coverages", () => {
    const json = reply(
      ["have", "probably"],
      ["Named twice.", "It is hard to say."],
    );

    expect(readReadings(json, 2)).toEqual([
      { index: 0, coverage: "have", reason: "Named twice." },
    ]);
  });

  it("drops a verdict that came with nothing to say for itself", () => {
    // A badge with no line beside it is half an answer, and the line is what
    // tells the user what to change. Leaving the Requirement unread is honest.
    const json = reply(["have", "missing"], ["Named twice.", "   "]);

    expect(readReadings(json, 2)).toEqual([
      { index: 0, coverage: "have", reason: "Named twice." },
    ]);
  });

  it("leaves a Requirement the reply ran out of answers for unread", () => {
    expect(readReadings(reply(["have"], ["Named twice."]), 2)).toEqual([
      { index: 0, coverage: "have", reason: "Named twice." },
    ]);
  });

  it("ignores a verdict about a Requirement nobody asked about", () => {
    expect(readReadings(BOTH, 1)).toEqual([
      {
        index: 0,
        coverage: "partial",
        reason: "Four years against the five asked for.",
      },
    ]);
  });

  it("keeps a reason to the length of a line", () => {
    const json = reply(["have"], ["x".repeat(MAX_REASON_LENGTH + 50)]);

    const [reading] = readReadings(json, 1);
    expect(reading?.reason).toHaveLength(MAX_REASON_LENGTH);
  });

  it("rejects a reply that answered about no Requirement at all", () => {
    // Not an Analysis of nothing: a provider that could not be understood, and
    // the endpoint has a different thing to say about each.
    expect(() => readReadings(reply([], []), 2)).toThrow();
  });

  it("rejects a reply whose arrays are not arrays", () => {
    expect(() => readReadings(reply("have", "Named twice."), 1)).toThrow();
  });

  it("rejects a reply that is not JSON at all", () => {
    expect(() => readReadings("not json", 1)).toThrow();
  });
});
