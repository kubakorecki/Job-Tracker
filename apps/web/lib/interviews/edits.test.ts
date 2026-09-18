import { CreateInterview, UpdateInterview, type Interview } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  arrangedFrom,
  blankInterviewEdits,
  interviewChangesFrom,
  interviewEditsFrom,
  type InterviewEdits,
} from "./edits";

/**
 * The Interviews panel's arithmetic, with no form in sight: a meeting as text a
 * form can hold, what that text amounts to when it is arranged, and what it
 * amounts to once the user has corrected it.
 */

const TODAY = "2026-09-17";

const HELD: Interview = {
  id: "00000000-0000-4000-8000-00000000000d",
  jobApplicationId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  heldOn: "2026-10-01",
  heldAt: "14:30",
  stage: "Phone screen",
  meetingUrl: "https://meet.example.com/abc",
  location: "Their office, 4th floor",
  notes: "Ask about the on-call rota.",
  arrangedOn: "2026-09-10",
  cancelled: false,
};

describe("blankInterviewEdits", () => {
  it("opens with today as the day the invitation arrived", () => {
    // Which is the ordinary case: the user is typing this in because an email
    // has just come. It is a box rather than a fact, so they can correct it to
    // the day it actually arrived.
    expect(blankInterviewEdits(TODAY)).toEqual({
      heldOn: "",
      heldAt: "",
      stage: "",
      meetingUrl: "",
      location: "",
      notes: "",
      arrangedOn: TODAY,
    });
  });
});

describe("interviewEditsFrom", () => {
  it("holds a meeting as text, with nothing unset reading as null", () => {
    expect(interviewEditsFrom(HELD)).toEqual({
      heldOn: "2026-10-01",
      heldAt: "14:30",
      stage: "Phone screen",
      meetingUrl: "https://meet.example.com/abc",
      location: "Their office, 4th floor",
      notes: "Ask about the on-call rota.",
      arrangedOn: "2026-09-10",
    });
  });

  it("holds what nobody recorded as an empty box", () => {
    expect(
      interviewEditsFrom({
        ...HELD,
        heldAt: null,
        meetingUrl: null,
        location: null,
        notes: null,
      }),
    ).toMatchObject({ heldAt: "", meetingUrl: "", location: "", notes: "" });
  });
});

describe("arrangedFrom", () => {
  const typed = (over: Partial<InterviewEdits> = {}): InterviewEdits => ({
    ...blankInterviewEdits(TODAY),
    heldOn: "2026-10-01",
    stage: "Phone screen",
    ...over,
  });

  it("is a meeting the contract accepts", () => {
    expect(CreateInterview.safeParse(arrangedFrom(typed())).success).toBe(true);
  });

  it("states the day it was arranged, because the form showed it", () => {
    expect(arrangedFrom(typed()).arrangedOn).toBe(TODAY);
  });

  it("turns every box the user left alone into nothing recorded", () => {
    expect(arrangedFrom(typed())).toEqual({
      heldOn: "2026-10-01",
      heldAt: null,
      stage: "Phone screen",
      meetingUrl: null,
      location: null,
      notes: null,
      cancelled: false,
      arrangedOn: TODAY,
    });
  });

  it("trims what the user typed, so a stray space is not a stage", () => {
    expect(
      arrangedFrom(typed({ stage: "  Final round  ", location: "   " })),
    ).toMatchObject({ stage: "Final round", location: null });
  });

  it("keeps a stage the contract will refuse, so the contract can name it", () => {
    const empty = arrangedFrom(typed({ stage: "   " }));

    expect(empty.stage).toBe("");
    expect(CreateInterview.safeParse(empty).success).toBe(false);
  });
});

describe("interviewChangesFrom", () => {
  const held = interviewEditsFrom(HELD);

  it("names nothing where nothing was touched", () => {
    expect(interviewChangesFrom(held, HELD)).toEqual({});
  });

  it("names only what the user moved", () => {
    expect(
      interviewChangesFrom({ ...held, heldOn: "2026-10-03" }, HELD),
    ).toEqual({ heldOn: "2026-10-03" });
  });

  it("says a box the user emptied as nothing recorded", () => {
    expect(interviewChangesFrom({ ...held, heldAt: "" }, HELD)).toEqual({
      heldAt: null,
    });
  });

  it("never names the cancellation, which is its own control", () => {
    // Calling a meeting off is a decision rather than a correction, and it
    // saves on the press — so a form full of unsaved edits cannot carry one,
    // and neither can it put one back.
    expect(
      Object.keys(interviewChangesFrom(held, { ...HELD, cancelled: true })),
    ).toEqual([]);
  });

  it("is a change the contract accepts", () => {
    expect(
      UpdateInterview.safeParse(
        interviewChangesFrom({ ...held, notes: "Two engineers." }, HELD),
      ).success,
    ).toBe(true);
  });
});
