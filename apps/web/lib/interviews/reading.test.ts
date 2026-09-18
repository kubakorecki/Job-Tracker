import type { Interview } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  inTheOrderHeld,
  lastInterviewHeld,
  nextInterview,
  nextInterviewDescription,
  nextInterviewLabel,
} from "./reading";

/**
 * What a list of meetings amounts to today. Read against a fixed today, as
 * everything in this app that counts days is.
 */

const TODAY = "2026-09-17";

let arranged = 0;

const interview = (
  over: Partial<Interview> & { heldOn: string },
): Interview => {
  arranged += 1;

  return {
    id: `interview-${arranged}`,
    jobApplicationId: "job-application-1",
    heldAt: null,
    stage: "Phone screen",
    meetingUrl: null,
    location: null,
    notes: null,
    arrangedOn: TODAY,
    cancelled: false,
    ...over,
  };
};

describe("nextInterview", () => {
  it("is nothing where no meeting has been arranged", () => {
    expect(nextInterview([], TODAY)).toBeNull();
  });

  it("is the soonest meeting still to come", () => {
    const soon = interview({ heldOn: "2026-09-24" });
    const later = interview({ heldOn: "2026-10-08" });

    expect(nextInterview([later, soon], TODAY)?.id).toBe(soon.id);
  });

  it("counts a meeting held today as still to come", () => {
    // Nobody is being ignored on the morning of their interview.
    const today = interview({ heldOn: TODAY });

    expect(nextInterview([today], TODAY)?.id).toBe(today.id);
  });

  it("is nothing where every meeting is behind the user", () => {
    expect(
      nextInterview([interview({ heldOn: "2026-09-16" })], TODAY),
    ).toBeNull();
  });

  it("passes over a meeting that was called off", () => {
    const called = interview({ heldOn: "2026-09-20", cancelled: true });
    const standing = interview({ heldOn: "2026-09-24" });

    expect(nextInterview([called, standing], TODAY)?.id).toBe(standing.id);
    expect(nextInterview([called], TODAY)).toBeNull();
  });
});

describe("lastInterviewHeld", () => {
  it("is nothing where no meeting has happened yet", () => {
    expect(
      lastInterviewHeld([interview({ heldOn: "2026-09-24" })], TODAY),
    ).toBeNull();
  });

  it("is the most recent meeting behind the user", () => {
    const first = interview({ heldOn: "2026-08-20" });
    const second = interview({ heldOn: "2026-09-10" });

    expect(lastInterviewHeld([first, second], TODAY)?.id).toBe(second.id);
  });

  it("does not count today's meeting as held", () => {
    // It is the meeting still to come, and counting a silence from a meeting
    // that has not happened would start the count today.
    expect(lastInterviewHeld([interview({ heldOn: TODAY })], TODAY)).toBeNull();
  });

  it("passes over a meeting that was called off", () => {
    // When it was called off is nowhere in the record, so it cannot be counted
    // from: the honest reading is that the last thing to happen was whatever
    // happened before it.
    const held = interview({ heldOn: "2026-08-20" });
    const called = interview({ heldOn: "2026-09-10", cancelled: true });

    expect(lastInterviewHeld([held, called], TODAY)?.id).toBe(held.id);
  });
});

describe("inTheOrderHeld", () => {
  it("puts a newly arranged meeting where it will be held", () => {
    const later = interview({ heldOn: "2026-10-08", stage: "Final round" });
    const sooner = interview({ heldOn: "2026-09-24", stage: "Phone screen" });

    expect(inTheOrderHeld([later, sooner]).map(({ stage }) => stage)).toEqual([
      "Phone screen",
      "Final round",
    ]);
  });

  it("orders two meetings on one day by the clock, the untimed one last", () => {
    const afternoon = interview({ heldOn: "2026-09-24", heldAt: "16:00" });
    const untimed = interview({ heldOn: "2026-09-24" });
    const morning = interview({ heldOn: "2026-09-24", heldAt: "09:00" });

    expect(
      inTheOrderHeld([untimed, afternoon, morning]).map(({ id }) => id),
    ).toEqual([morning.id, afternoon.id, untimed.id]);
  });

  it("leaves the list it was given alone", () => {
    const later = interview({ heldOn: "2026-10-08" });
    const sooner = interview({ heldOn: "2026-09-24" });
    const held = [later, sooner];

    inTheOrderHeld(held);

    expect(held).toEqual([later, sooner]);
  });
});

describe("nextInterviewLabel", () => {
  it("names the day, which is what the card has room for", () => {
    expect(nextInterviewLabel(interview({ heldOn: "2026-09-24" }), TODAY)).toBe(
      "Interview 24 Sept",
    );
  });

  it("says today and tomorrow in words", () => {
    expect(nextInterviewLabel(interview({ heldOn: TODAY }), TODAY)).toBe(
      "Interview today",
    );
    expect(nextInterviewLabel(interview({ heldOn: "2026-09-18" }), TODAY)).toBe(
      "Interview tomorrow",
    );
  });
});

describe("nextInterviewDescription", () => {
  it("is the sentence the label abbreviates: the stage, the year, the wait", () => {
    expect(
      nextInterviewDescription(
        interview({ heldOn: "2026-09-24", stage: "Take-home review" }),
        TODAY,
      ),
    ).toBe("Take-home review on 24 Sept 2026, in 7 days.");
  });

  it("says the time of day where the user knows it", () => {
    expect(
      nextInterviewDescription(
        interview({ heldOn: "2026-09-18", heldAt: "14:30" }),
        TODAY,
      ),
    ).toBe("Phone screen on 18 Sept 2026 at 14:30, tomorrow.");
  });

  it("says today on the day itself", () => {
    expect(nextInterviewDescription(interview({ heldOn: TODAY }), TODAY)).toBe(
      "Phone screen on 17 Sept 2026, today.",
    );
  });
});
