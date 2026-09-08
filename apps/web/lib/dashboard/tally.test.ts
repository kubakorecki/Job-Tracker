import type { JobApplication, JobStatus } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { tallyClauses, tallyOf, type Tally } from "./tally";

/**
 * The four numbers the board opens with. Counted against a fixed today, for
 * the same reason the silence they are made of is.
 */

const TODAY = "2026-09-06";

const daysAgo = (days: number): string =>
  new Date(
    Date.parse(`${TODAY}T00:00:00.000Z`) - days * 24 * 60 * 60 * 1000,
  ).toISOString();

let next = 0;

const aJobApplication = (
  status: JobStatus,
  quietFor = 0,
): JobApplication =>
  ({
    id: String((next += 1)),
    userId: "u",
    company: "Basecamp",
    jobTitle: "Programmer",
    jobUrl: null,
    location: null,
    remoteType: null,
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: null,
    closesOn: null,
    currency: null,
    description: null,
    requirements: [],
    status,
    source: null,
    appliedAt: null,
    excitement: null,
    notes: null,
    createdAt: daysAgo(quietFor),
    updatedAt: daysAgo(quietFor),
  }) as JobApplication;

const tally = (jobApplications: JobApplication[]): Tally =>
  tallyOf(jobApplications, TODAY);

describe("tallyOf", () => {
  it("counts nothing out of nothing", () => {
    expect(tally([])).toEqual({
      tracked: 0,
      inTheAir: 0,
      quiet: 0,
      cold: 0,
      ghosted: 0,
      offers: 0,
    });
  });

  it("counts everything as tracked, whatever became of it", () => {
    expect(
      tally([
        aJobApplication("bookmarked"),
        aJobApplication("rejected"),
        aJobApplication("withdrawn"),
      ]).tracked,
    ).toBe(3);
  });

  it("counts only the ones still waiting on somebody as in the air", () => {
    const counted = tally([
      aJobApplication("applied"),
      aJobApplication("interviewing"),
      aJobApplication("bookmarked"),
      aJobApplication("offer"),
      aJobApplication("rejected"),
    ]);

    expect(counted.inTheAir).toBe(2);
  });

  it("counts every reading of silence as quiet, and each rung on its own", () => {
    const counted = tally([
      aJobApplication("applied", 3), // fresh
      aJobApplication("applied", 12), // quiet
      aJobApplication("applied", 30), // cold
      aJobApplication("interviewing", 60), // ghosted
    ]);

    expect(counted).toMatchObject({ quiet: 3, cold: 1, ghosted: 1 });
  });

  it("never counts a Job Application nobody is waiting on as quiet", () => {
    const counted = tally([
      aJobApplication("bookmarked", 90),
      aJobApplication("rejected", 90),
      aJobApplication("withdrawn", 90),
      aJobApplication("offer", 90),
    ]);

    expect(counted).toMatchObject({ quiet: 0, cold: 0, ghosted: 0 });
  });

  it("counts the offers", () => {
    expect(tally([aJobApplication("offer"), aJobApplication("offer")]).offers).toBe(2);
  });
});

describe("tallyClauses", () => {
  const sentence = (jobApplications: JobApplication[]) =>
    tallyClauses(tally(jobApplications))
      .map(({ count, says }) => `${count} ${says}`)
      .join(" ");

  it("says the whole thing when there is a whole thing to say", () => {
    expect(
      sentence([
        aJobApplication("applied", 60),
        aJobApplication("applied", 2),
        aJobApplication("interviewing", 30),
        aJobApplication("offer"),
        aJobApplication("bookmarked"),
      ]),
    ).toBe(
      "5 tracked. 3 still in the air. 2 have gone quiet on you. 1 offer.",
    );
  });

  it("leaves out what would only report nothing", () => {
    expect(sentence([aJobApplication("bookmarked")])).toBe("1 tracked.");
  });

  it("does not call one offer several", () => {
    expect(sentence([aJobApplication("offer"), aJobApplication("offer")])).toBe(
      "2 tracked. 2 offers.",
    );
  });
});
