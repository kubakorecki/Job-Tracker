import type { Interview, JobApplication, JobStatus } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { threadOf, type Beat } from "./thread";

/**
 * What has happened on one Job Application, in order, ending in where it
 * stands today. Read against a fixed today, as everything that counts days is.
 */

const TODAY = "2026-09-06";

const daysAgo = (days: number): string =>
  new Date(
    Date.parse(`${TODAY}T00:00:00.000Z`) - days * 24 * 60 * 60 * 1000,
  ).toISOString();

/** The same, as a calendar day: what an Interview's two dates are held as. */
const dayAgo = (days: number): string => daysAgo(days).slice(0, 10);

type Record = Pick<
  JobApplication,
  "status" | "appliedAt" | "createdAt" | "updatedAt" | "interviews"
>;

const record = (status: JobStatus, over: Partial<Record> = {}): Record => ({
  status,
  appliedAt: null,
  createdAt: daysAgo(60),
  updatedAt: daysAgo(60),
  interviews: [],
  ...over,
});

/** A meeting, with nothing recorded but what a case is about. */
const interview = (
  over: Partial<Interview> & { heldOn: string; arrangedOn: string },
): Interview => ({
  id: `interview-${over.heldOn}`,
  jobApplicationId: "job-application-1",
  heldAt: null,
  stage: "Phone screen",
  meetingUrl: null,
  location: null,
  notes: null,
  cancelled: false,
  ...over,
});

const thread = (status: JobStatus, over: Partial<Record> = {}): Beat[] =>
  threadOf(record(status, over), TODAY);

describe("threadOf", () => {
  it("opens with the day the user saved it", () => {
    expect(thread("bookmarked")[0]).toEqual({
      kind: "event",
      what: "You saved it",
      when: "8 Jul 2026",
    } satisfies Beat);
  });

  it("says a bookmarked one has not been sent anywhere", () => {
    expect(thread("bookmarked").at(-1)).toEqual({
      kind: "now",
      what: "Not applied for yet",
      when: "Nobody has it to ignore.",
    } satisfies Beat);
  });

  it("records the day the user applied", () => {
    expect(thread("applied", { appliedAt: daysAgo(50) })[1]).toEqual({
      kind: "event",
      what: "You applied",
      when: "18 Jul 2026",
    } satisfies Beat);
  });

  it("breaks the thread where a silence has run on, and ends in the count", () => {
    expect(thread("applied", { appliedAt: daysAgo(50) }).slice(2)).toEqual([
      {
        kind: "gap",
        what: "Then nothing.",
        when: "Nothing heard since 18 Jul 2026",
      },
      {
        kind: "now",
        what: "50 days of quiet",
        when: "Long enough to stop counting. Nobody owes you a reply.",
      },
    ] satisfies Beat[]);
  });

  it("counts from the last thing that happened, not from the day it was saved", () => {
    const beats = thread("interviewing", {
      appliedAt: daysAgo(50),
      updatedAt: daysAgo(30),
    });

    expect(beats.at(-1)).toEqual({
      kind: "now",
      what: "30 days of quiet",
      when: "Long enough to stop waiting on it. Not long enough to call it.",
    } satisfies Beat);
  });

  it("has no gap to report while the wait is still ordinary", () => {
    expect(
      thread("applied", { appliedAt: daysAgo(3), updatedAt: daysAgo(3) }).at(
        -1,
      ),
    ).toEqual({
      kind: "now",
      what: "Nothing to read into yet",
      when: "Somebody has been heard from in the last week.",
    } satisfies Beat);
  });

  it("ends on the answer where one has come", () => {
    expect(thread("offer", { appliedAt: daysAgo(50) }).at(-1)).toEqual({
      kind: "now",
      what: "An offer",
      when: "Recorded 8 Jul 2026",
    } satisfies Beat);
  });

  it("says who ended it, where the user did", () => {
    expect(thread("withdrawn").at(-1)?.what).toBe("You withdrew");
    expect(thread("rejected").at(-1)?.what).toBe("They said no");
  });
});

describe("threadOf, with Interviews on it", () => {
  it("draws a beat for the invitation and one for the meeting", () => {
    const beats = thread("interviewing", {
      appliedAt: daysAgo(50),
      interviews: [
        interview({
          arrangedOn: dayAgo(30),
          heldOn: dayAgo(20),
          stage: "Phone screen",
        }),
      ],
    });

    expect(beats.slice(1, 4)).toEqual([
      { kind: "event", what: "You applied", when: "18 Jul 2026" },
      {
        kind: "event",
        what: "Interview arranged — Phone screen",
        when: "7 Aug 2026",
      },
      {
        kind: "event",
        what: "You interviewed — Phone screen",
        when: "17 Aug 2026",
      },
    ] satisfies Beat[]);
  });

  it("puts the beats in the order they happened, whatever order they were recorded in", () => {
    // The invitation to the second round arrived before the first was held, and
    // the user typed the second one in first.
    const beats = thread("interviewing", {
      appliedAt: daysAgo(50),
      interviews: [
        interview({
          arrangedOn: dayAgo(18),
          heldOn: dayAgo(10),
          stage: "Final round",
        }),
        interview({
          arrangedOn: dayAgo(30),
          heldOn: dayAgo(16),
          stage: "Phone screen",
        }),
      ],
    });

    expect(beats.map(({ what }) => what)).toEqual([
      "You saved it",
      "You applied",
      "Interview arranged — Phone screen",
      "Interview arranged — Final round",
      "You interviewed — Phone screen",
      "You interviewed — Final round",
      "Then nothing.",
      "10 days of quiet",
    ]);
  });

  it("ends on the meeting still to come rather than on a silence", () => {
    const beats = thread("interviewing", {
      appliedAt: daysAgo(50),
      updatedAt: daysAgo(50),
      interviews: [
        interview({
          arrangedOn: dayAgo(2),
          heldOn: dayAgo(-8),
          stage: "Final round",
        }),
      ],
    });

    // Fifty days of nothing, and none of it is a silence: there is a meeting in
    // the diary (ADR-0011).
    expect(beats.at(-1)).toEqual({
      kind: "now",
      what: "Interview 14 Sept",
      when: "Final round on 14 Sept 2026, in 8 days.",
    } satisfies Beat);
  });

  it("draws no held beat for a meeting that has not happened yet", () => {
    const beats = thread("interviewing", {
      interviews: [interview({ arrangedOn: dayAgo(2), heldOn: dayAgo(-8) })],
    });

    expect(beats.map(({ what }) => what)).toEqual([
      "You saved it",
      "Interview arranged — Phone screen",
      "Interview 14 Sept",
    ]);
  });

  it("marks a meeting that was called off, in one beat rather than two", () => {
    const beats = thread("applied", {
      appliedAt: daysAgo(50),
      interviews: [
        interview({
          arrangedOn: dayAgo(30),
          heldOn: dayAgo(20),
          stage: "Phone screen",
          cancelled: true,
        }),
      ],
    });

    // It was never held, so there is no holding to draw — but arranging it was
    // still something the employer did, and the beat says both.
    expect(beats[2]).toEqual({
      kind: "event",
      what: "Phone screen — called off",
      when: "Arranged 7 Aug 2026, for 17 Aug 2026",
    } satisfies Beat);
    expect(beats.map(({ what }) => what)).not.toContain(
      "You interviewed — Phone screen",
    );
  });

  it("counts the silence from the last meeting held, not from the record", () => {
    const beats = thread("interviewing", {
      appliedAt: daysAgo(90),
      updatedAt: daysAgo(1),
      interviews: [interview({ arrangedOn: dayAgo(40), heldOn: dayAgo(25) })],
    });

    expect(beats.slice(-2)).toEqual([
      {
        kind: "gap",
        what: "Then nothing.",
        when: "Nothing heard since 12 Aug 2026",
      },
      {
        kind: "now",
        what: "25 days of quiet",
        when: "Long enough to stop waiting on it. Not long enough to call it.",
      },
    ] satisfies Beat[]);
  });

  it("still ends on the answer where one has come, whatever is in the diary", () => {
    // A meeting nobody got round to calling off, on a Job Application that has
    // been answered. The rail ends in where it stands, and where it stands is
    // rejected — which is the order `silenceOf` reads the two in as well.
    const beats = thread("rejected", {
      appliedAt: daysAgo(50),
      interviews: [interview({ arrangedOn: dayAgo(10), heldOn: dayAgo(-4) })],
    });

    expect(beats.at(-1)).toEqual({
      kind: "now",
      what: "They said no",
      when: "Recorded 8 Jul 2026",
    } satisfies Beat);
  });

  it("draws the invitation even on a Job Application that was answered", () => {
    // The employer arranged it, and the rail is what happened rather than what
    // is still true — so the beat stays whatever the Status came to be.
    const beats = thread("rejected", {
      appliedAt: daysAgo(50),
      interviews: [interview({ arrangedOn: dayAgo(10), heldOn: dayAgo(-4) })],
    });

    expect(beats.map(({ what }) => what)).toContain(
      "Interview arranged — Phone screen",
    );
  });

  it("ends on a meeting still to come only where the user is waiting", () => {
    const waiting = thread("interviewing", {
      appliedAt: daysAgo(50),
      interviews: [interview({ arrangedOn: dayAgo(10), heldOn: dayAgo(-4) })],
    });

    expect(waiting.at(-1)).toEqual({
      kind: "now",
      what: "Interview 10 Sept",
      when: "Phone screen on 10 Sept 2026, in 4 days.",
    } satisfies Beat);
  });
});
