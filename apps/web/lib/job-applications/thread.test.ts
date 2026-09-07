import type { JobApplication, JobStatus } from "@repo/schema";
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

type Record = Pick<
  JobApplication,
  "status" | "appliedAt" | "createdAt" | "updatedAt"
>;

const record = (status: JobStatus, over: Partial<Record> = {}): Record => ({
  status,
  appliedAt: null,
  createdAt: daysAgo(60),
  updatedAt: daysAgo(60),
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
