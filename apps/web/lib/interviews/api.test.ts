import type { Interview, JobApplication } from "@repo/schema";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { authenticatedRoute } from "../api/authenticated-route";
import type { CurrentUser } from "../auth/current-user";
import { todayInUtc } from "../day";
import {
  createJobApplicationResponse,
  readJobApplicationResponse,
} from "../job-applications/api";
import { deleteJobApplication } from "../job-applications/repository";
import {
  bearer,
  forgetTestTokens,
} from "../test-support/personal-access-tokens";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  addInterviewResponse,
  deleteInterviewResponse,
  updateInterviewResponse,
} from "./api";

/**
 * The Interview endpoints, against the dev Supabase project (ADR-0003), as the
 * two fixed test users. Every assertion is about what a client can see — a
 * status code, a response body — and the meetings are read back through the Job
 * Application, which is the only place a client reads them from.
 *
 * They reach the endpoints the way the extension would: through the wrapper
 * that resolves the caller, carrying a Bearer Personal Access Token and no
 * session at all.
 */

const ENDPOINT = "https://job-tracker.test/api/job-applications";

const jobApplications = {
  post: authenticatedRoute(createJobApplicationResponse),
  get: authenticatedRoute<{ id: string }>(readJobApplicationResponse),
};

type CollectionParams = { id: string };
type ItemParams = { id: string; interviewId: string };

const collection = {
  post: authenticatedRoute<CollectionParams>(addInterviewResponse),
};

const item = {
  patch: authenticatedRoute<ItemParams>(updateInterviewResponse),
  delete: authenticatedRoute<ItemParams>(deleteInterviewResponse),
};

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

afterAll(forgetTestTokens);

afterEach(async () => {
  // No test may assume an empty database, so each one leaves it as it found it.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
});

async function saveJobApplication(
  user: CurrentUser = TEST_USER,
): Promise<JobApplication> {
  const response = await jobApplications.post(
    new Request(ENDPOINT, {
      method: "POST",
      headers: await bearer(user),
      body: JSON.stringify({
        company: "Linear",
        jobTitle: "Product Engineer",
        status: "applied",
      }),
    }),
    { params: Promise.resolve({}) },
  );

  expect(response.status).toBe(201);
  const created: JobApplication = await response.json();
  saved.push({ userId: user.id, id: created.id });
  return created;
}

async function post(
  user: CurrentUser,
  id: string,
  body: unknown,
): Promise<Response> {
  return collection.post(
    new Request(`${ENDPOINT}/${id}/interviews`, {
      method: "POST",
      headers: await bearer(user),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

/** Arranges a meeting, failing loudly if the endpoint refused it. */
async function arrange(
  user: CurrentUser,
  id: string,
  body: unknown,
): Promise<Interview> {
  const response = await post(user, id, body);
  expect(response.status).toBe(201);
  return response.json();
}

async function patch(
  user: CurrentUser,
  params: ItemParams,
  body: unknown,
): Promise<Response> {
  return item.patch(
    new Request(`${ENDPOINT}/${params.id}/interviews/${params.interviewId}`, {
      method: "PATCH",
      headers: await bearer(user),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve(params) },
  );
}

async function remove(
  user: CurrentUser,
  params: ItemParams,
): Promise<Response> {
  return item.delete(
    new Request(`${ENDPOINT}/${params.id}/interviews/${params.interviewId}`, {
      method: "DELETE",
      headers: await bearer(user),
    }),
    { params: Promise.resolve(params) },
  );
}

/** One Job Application's meetings, as the only read a client has of them. */
async function interviewsOn(
  user: CurrentUser,
  id: string,
): Promise<Interview[]> {
  const response = await jobApplications.get(
    new Request(`${ENDPOINT}/${id}`, { headers: await bearer(user) }),
    { params: Promise.resolve({ id }) },
  );

  expect(response.status).toBe(200);
  const jobApplication: JobApplication = await response.json();
  return jobApplication.interviews;
}

/** Ids shaped like the things they name, belonging to nothing. */
const NO_SUCH_JOB_APPLICATION = "00000000-0000-4000-8000-00000000dead";
const NO_SUCH_INTERVIEW = "00000000-0000-4000-8000-00000000beef";

describe("POST /api/job-applications/:id/interviews", () => {
  it("arranges a meeting given a day and a stage", async () => {
    const jobApplication = await saveJobApplication();

    const response = await post(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: expect.any(String),
      jobApplicationId: jobApplication.id,
      heldOn: "2026-10-01",
      heldAt: null,
      stage: "Phone screen",
      meetingUrl: null,
      location: null,
      notes: null,
      // The day the endpoint was asked on, because this body named none.
      arrangedOn: todayInUtc(),
      cancelled: false,
    });
  });

  it("takes everything the invitation said", async () => {
    const jobApplication = await saveJobApplication();

    const arranged = await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      heldAt: "14:30",
      stage: "Take-home review",
      meetingUrl: "https://meet.example.com/abc",
      location: "Their office, 4th floor",
      notes: "Ask about the on-call rota.",
      arrangedOn: "2026-09-10",
    });

    expect(arranged).toMatchObject({
      heldAt: "14:30",
      meetingUrl: "https://meet.example.com/abc",
      location: "Their office, 4th floor",
      notes: "Ask about the on-call rota.",
      arrangedOn: "2026-09-10",
    });
  });

  it("puts it on the Job Application a client reads", async () => {
    const jobApplication = await saveJobApplication();
    const arranged = await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    expect(await interviewsOn(TEST_USER, jobApplication.id)).toEqual([
      arranged,
    ]);
  });

  it("does not move the Status, whatever the meeting says", async () => {
    const jobApplication = await saveJobApplication();
    await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    const response = await jobApplications.get(
      new Request(`${ENDPOINT}/${jobApplication.id}`, {
        headers: await bearer(TEST_USER),
      }),
      { params: Promise.resolve({ id: jobApplication.id }) },
    );
    const reloaded: JobApplication = await response.json();

    // The prompt is the feature and the move is an ordinary patch the user
    // asks for: nothing here infers a Status (ADR-0011).
    expect(reloaded.status).toBe("applied");
  });

  it("refuses a meeting with no day to be held on", async () => {
    const jobApplication = await saveJobApplication();

    const response = await post(TEST_USER, jobApplication.id, {
      stage: "Phone screen",
    });

    expect(response.status).toBe(400);
  });

  it("refuses a meeting with no stage the user worded", async () => {
    const jobApplication = await saveJobApplication();

    const response = await post(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "",
    });

    expect(response.status).toBe(400);
  });

  it("refuses a day that is not a calendar day", async () => {
    const jobApplication = await saveJobApplication();

    const response = await post(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01T09:00:00.000Z",
      stage: "Phone screen",
    });

    expect(response.status).toBe(400);
  });

  it("never arranges one on another user's Job Application", async () => {
    const theirs = await saveJobApplication(OTHER_TEST_USER);

    const response = await post(TEST_USER, theirs.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    expect(response.status).toBe(404);
    expect(await interviewsOn(OTHER_TEST_USER, theirs.id)).toEqual([]);
  });

  it("refuses a Job Application that does not exist", async () => {
    const response = await post(TEST_USER, NO_SUCH_JOB_APPLICATION, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    expect(response.status).toBe(404);
  });

  it("refuses an id that could never be a Job Application's", async () => {
    const response = await post(TEST_USER, "not-a-uuid", {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/job-applications/:id/interviews/:interviewId", () => {
  it("reschedules a meeting, leaving what it did not name alone", async () => {
    const jobApplication = await saveJobApplication();
    const arranged = await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      heldAt: "09:00",
      stage: "Phone screen",
      notes: "Ask about the on-call rota.",
    });

    const response = await patch(
      TEST_USER,
      { id: jobApplication.id, interviewId: arranged.id },
      { heldOn: "2026-10-05" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ...arranged,
      heldOn: "2026-10-05",
    });
  });

  it("calls a meeting off and keeps it", async () => {
    const jobApplication = await saveJobApplication();
    const arranged = await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    const response = await patch(
      TEST_USER,
      { id: jobApplication.id, interviewId: arranged.id },
      { cancelled: true },
    );

    expect(response.status).toBe(200);
    // Arranging it was still something the employer did, so the Job
    // Application still carries it — marked.
    expect(await interviewsOn(TEST_USER, jobApplication.id)).toEqual([
      { ...arranged, cancelled: true },
    ]);
  });

  it("refuses a change that is not one an Interview can take", async () => {
    const jobApplication = await saveJobApplication();
    const arranged = await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    const response = await patch(
      TEST_USER,
      { id: jobApplication.id, interviewId: arranged.id },
      { heldAt: "half past two" },
    );

    expect(response.status).toBe(400);
  });

  it("never changes another user's meeting", async () => {
    const theirs = await saveJobApplication(OTHER_TEST_USER);
    const arranged = await arrange(OTHER_TEST_USER, theirs.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    const response = await patch(
      TEST_USER,
      { id: theirs.id, interviewId: arranged.id },
      { heldOn: "2026-12-25" },
    );

    expect(response.status).toBe(404);
    expect(await interviewsOn(OTHER_TEST_USER, theirs.id)).toEqual([arranged]);
  });

  it("refuses a meeting addressed through a Job Application it is not on", async () => {
    const jobApplication = await saveJobApplication();
    const elsewhere = await saveJobApplication();
    const arranged = await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    const response = await patch(
      TEST_USER,
      { id: elsewhere.id, interviewId: arranged.id },
      { heldOn: "2026-12-25" },
    );

    expect(response.status).toBe(404);
  });

  it("refuses an Interview that does not exist", async () => {
    const jobApplication = await saveJobApplication();

    const response = await patch(
      TEST_USER,
      { id: jobApplication.id, interviewId: NO_SUCH_INTERVIEW },
      { heldOn: "2026-12-25" },
    );

    expect(response.status).toBe(404);
  });

  it("refuses an id that could never be an Interview's", async () => {
    const jobApplication = await saveJobApplication();

    const response = await patch(
      TEST_USER,
      { id: jobApplication.id, interviewId: "not-a-uuid" },
      { heldOn: "2026-12-25" },
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/job-applications/:id/interviews/:interviewId", () => {
  it("removes a meeting recorded by mistake, and it stays gone", async () => {
    const jobApplication = await saveJobApplication();
    const arranged = await arrange(TEST_USER, jobApplication.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });
    const params = { id: jobApplication.id, interviewId: arranged.id };

    const response = await remove(TEST_USER, params);

    expect(response.status).toBe(204);
    expect(await interviewsOn(TEST_USER, jobApplication.id)).toEqual([]);

    // By then there is nothing there to be the caller's, which is the answer a
    // second delete of a Job Application gets too.
    expect((await remove(TEST_USER, params)).status).toBe(404);
  });

  it("never removes another user's meeting", async () => {
    const theirs = await saveJobApplication(OTHER_TEST_USER);
    const arranged = await arrange(OTHER_TEST_USER, theirs.id, {
      heldOn: "2026-10-01",
      stage: "Phone screen",
    });

    const response = await remove(TEST_USER, {
      id: theirs.id,
      interviewId: arranged.id,
    });

    expect(response.status).toBe(404);
    expect(await interviewsOn(OTHER_TEST_USER, theirs.id)).toEqual([arranged]);
  });
});

describe("reaching the Interview endpoints as the extension would", () => {
  it("refuses a token that was never issued, before it looks anything up", async () => {
    const jobApplication = await saveJobApplication();

    const response = await collection.post(
      new Request(`${ENDPOINT}/${jobApplication.id}/interviews`, {
        method: "POST",
        headers: { authorization: "Bearer jbt_nope" },
        body: JSON.stringify({ heldOn: "2026-10-01", stage: "Phone screen" }),
      }),
      { params: Promise.resolve({ id: jobApplication.id }) },
    );

    expect(response.status).toBe(401);
    expect(await interviewsOn(TEST_USER, jobApplication.id)).toEqual([]);
  });
});
