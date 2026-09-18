import { CreateInterview, CreateJobApplication } from "@repo/schema";
import { afterEach, describe, expect, it } from "vitest";
import { todayInUtc } from "../day";
import {
  createJobApplication,
  deleteJobApplication,
} from "../job-applications/repository";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  addInterview,
  deleteInterview,
  interviewsFor,
  updateInterview,
} from "./repository";

/**
 * The meetings one Job Application's recruitment is made of. Real rows in the
 * real database — there is no local stack (ADR-0003) — and every case reaches
 * them through this module, which is the only thing in the app that writes
 * them.
 *
 * What is worth proving is the part the function names do not say: that a
 * meeting is found by the day it is held rather than the order it was typed
 * in, that the day it was arranged is today unless the user says otherwise,
 * that calling one off keeps it, and that none of this is reachable by anybody
 * but its owner.
 */

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

afterEach(async () => {
  // No test may assume an empty database, so each one leaves it as it found it.
  // The Interviews go with the Job Application, by the cascade one case below
  // is about.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
});

async function saveJobApplication(user = TEST_USER): Promise<string> {
  const created = await createJobApplication(
    user.id,
    CreateJobApplication.parse({ company: "Acme", jobTitle: "Engineer" }),
  );

  saved.push({ userId: user.id, id: created.id });
  return created.id;
}

/** Arranges a meeting, failing loudly if the Job Application refused it. */
async function arrange(
  jobApplicationId: string,
  interview: Partial<CreateInterview> & { heldOn: string },
  user = TEST_USER,
) {
  const added = await addInterview(
    user.id,
    jobApplicationId,
    CreateInterview.parse({ stage: "Phone screen", ...interview }),
  );

  expect(added).not.toBeNull();
  return added!;
}

describe("arranging an Interview", () => {
  it("answers with the meeting as it now stands", async () => {
    const jobApplicationId = await saveJobApplication();

    const added = await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      heldAt: "14:30",
      stage: "Take-home review",
      meetingUrl: "https://meet.example.com/abc",
      location: "Their office, 4th floor",
      notes: "Ask about the on-call rota.",
      arrangedOn: "2026-09-20",
    });

    expect(added).toEqual({
      id: expect.any(String),
      jobApplicationId,
      heldOn: "2026-10-01",
      heldAt: "14:30",
      stage: "Take-home review",
      meetingUrl: "https://meet.example.com/abc",
      location: "Their office, 4th floor",
      notes: "Ask about the on-call rota.",
      arrangedOn: "2026-09-20",
      cancelled: false,
    });
  });

  it("dates an invitation that named no day today", async () => {
    const jobApplicationId = await saveJobApplication();

    const added = await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    expect(added.arrangedOn).toBe(todayInUtc());
  });

  it("keeps the day the user said the invitation arrived", async () => {
    const jobApplicationId = await saveJobApplication();

    // An invitation that arrived last week is not news from today, which is
    // the whole reason this is a field the user can correct.
    const added = await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      arrangedOn: "2026-09-10",
    });

    expect(added.arrangedOn).toBe("2026-09-10");
  });

  it("refuses to arrange one on a Job Application that is not this user's", async () => {
    const jobApplicationId = await saveJobApplication();

    const added = await addInterview(
      OTHER_TEST_USER.id,
      jobApplicationId,
      CreateInterview.parse({ heldOn: "2026-10-01", stage: "Phone screen" }),
    );

    // The same answer a stranger gets everywhere else: nothing, rather than a
    // meeting hanging off somebody else's Job Application.
    expect(added).toBeNull();
    expect(await interviewsFor(TEST_USER.id, jobApplicationId)).toEqual([]);
  });
});

describe("reading a Job Application's Interviews", () => {
  it("answers in the order they are held, not the order they were typed in", async () => {
    const jobApplicationId = await saveJobApplication();

    await arrange(jobApplicationId, {
      heldOn: "2026-10-08",
      stage: "Final round",
    });
    await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    const held = await interviewsFor(TEST_USER.id, jobApplicationId);

    expect(held.map(({ stage }) => stage)).toEqual([
      "Phone screen",
      "Final round",
    ]);
  });

  it("puts two meetings on one day in the order of the clock", async () => {
    const jobApplicationId = await saveJobApplication();

    await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      heldAt: "16:00",
      stage: "Afternoon",
    });
    await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      stage: "No time given",
    });
    await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      heldAt: "09:00",
      stage: "Morning",
    });

    const held = await interviewsFor(TEST_USER.id, jobApplicationId);

    // The one nobody has a time for comes last: it is the only one the day
    // cannot place, and putting it first would claim a time it has not got.
    expect(held.map(({ stage }) => stage)).toEqual([
      "Morning",
      "Afternoon",
      "No time given",
    ]);
  });

  it("answers with nothing for another user's Job Application", async () => {
    const jobApplicationId = await saveJobApplication();
    await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    expect(await interviewsFor(OTHER_TEST_USER.id, jobApplicationId)).toEqual(
      [],
    );
  });
});

describe("correcting an Interview", () => {
  it("reschedules it in place, leaving everything it did not name alone", async () => {
    const jobApplicationId = await saveJobApplication();
    const added = await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      heldAt: "09:00",
      notes: "Ask about the on-call rota.",
    });

    const moved = await updateInterview(
      TEST_USER.id,
      jobApplicationId,
      added.id,
      { heldOn: "2026-10-03", heldAt: "11:15" },
    );

    expect(moved).toEqual({
      ...added,
      heldOn: "2026-10-03",
      heldAt: "11:15",
    });
  });

  it("keeps a meeting that was called off, marked", async () => {
    const jobApplicationId = await saveJobApplication();
    const added = await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    const cancelled = await updateInterview(
      TEST_USER.id,
      jobApplicationId,
      added.id,
      { cancelled: true },
    );

    expect(cancelled?.cancelled).toBe(true);
    // Arranging it was still something the employer did, so it is in the list
    // rather than gone from it.
    expect(await interviewsFor(TEST_USER.id, jobApplicationId)).toEqual([
      cancelled,
    ]);
  });

  it("takes a time of day off again", async () => {
    const jobApplicationId = await saveJobApplication();
    const added = await arrange(jobApplicationId, {
      heldOn: "2026-10-01",
      heldAt: "09:00",
    });

    const untimed = await updateInterview(
      TEST_USER.id,
      jobApplicationId,
      added.id,
      { heldAt: null },
    );

    expect(untimed?.heldAt).toBeNull();
  });

  it("corrects nothing for a user the Interview does not belong to", async () => {
    const jobApplicationId = await saveJobApplication();
    const added = await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    const moved = await updateInterview(
      OTHER_TEST_USER.id,
      jobApplicationId,
      added.id,
      { heldOn: "2026-12-25" },
    );

    expect(moved).toBeNull();
    expect((await interviewsFor(TEST_USER.id, jobApplicationId))[0]).toEqual(
      added,
    );
  });

  it("corrects nothing when the Interview is on another Job Application", async () => {
    const jobApplicationId = await saveJobApplication();
    const elsewhere = await saveJobApplication();
    const added = await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    // The address names both, so a meeting cannot be moved by asking about it
    // through a Job Application it is not on.
    expect(
      await updateInterview(TEST_USER.id, elsewhere, added.id, {
        heldOn: "2026-12-25",
      }),
    ).toBeNull();
  });
});

describe("deleting an Interview", () => {
  it("takes it out of the list", async () => {
    const jobApplicationId = await saveJobApplication();
    const added = await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    expect(
      await deleteInterview(TEST_USER.id, jobApplicationId, added.id),
    ).toBe(true);
    expect(await interviewsFor(TEST_USER.id, jobApplicationId)).toEqual([]);
  });

  it("answers the same way twice: there is nothing there to be anybody's", async () => {
    const jobApplicationId = await saveJobApplication();
    const added = await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    await deleteInterview(TEST_USER.id, jobApplicationId, added.id);

    expect(
      await deleteInterview(TEST_USER.id, jobApplicationId, added.id),
    ).toBe(false);
  });

  it("deletes nothing for a user the Interview does not belong to", async () => {
    const jobApplicationId = await saveJobApplication();
    const added = await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    expect(
      await deleteInterview(OTHER_TEST_USER.id, jobApplicationId, added.id),
    ).toBe(false);
    expect(await interviewsFor(TEST_USER.id, jobApplicationId)).toHaveLength(1);
  });
});

describe("deleting the Job Application", () => {
  it("takes its Interviews with it", async () => {
    const jobApplicationId = await saveJobApplication();
    await arrange(jobApplicationId, { heldOn: "2026-10-01" });

    await deleteJobApplication(TEST_USER.id, jobApplicationId);
    saved.length = 0;

    expect(await interviewsFor(TEST_USER.id, jobApplicationId)).toEqual([]);
  });
});
