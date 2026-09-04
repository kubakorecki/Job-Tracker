import type { JobApplication } from "@repo/schema";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { authenticatedRoute } from "../api/authenticated-route";
import type { CurrentUser } from "../auth/current-user";
import {
  bearer,
  forgetTestTokens,
  issueTestToken,
} from "../test-support/personal-access-tokens";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  createJobApplicationResponse,
  deleteJobApplicationResponse,
  listJobApplicationsResponse,
  readJobApplicationResponse,
  updateJobApplicationResponse,
} from "./api";
import { deleteJobApplication } from "./repository";

/**
 * These run against the dev Supabase project (ADR-0003), serially, as the two
 * fixed test users. Every assertion is about what a client can see — a status
 * code, a response body — never about how it was produced. The one query they
 * make is the delete that takes their own rows away again.
 *
 * They reach the endpoints the way the extension does: through the wrapper
 * that resolves the caller, carrying a Bearer Personal Access Token and no
 * session at all. That is what proves the whole API is reachable without the
 * auth service.
 */

const ENDPOINT = "https://job-tracker.test/api/job-applications";

/** The routes, assembled exactly as `app/api/job-applications` assembles them. */
const collection = {
  get: authenticatedRoute(listJobApplicationsResponse),
  post: authenticatedRoute(createJobApplicationResponse),
};

type Params = { id: string };

const item = {
  get: authenticatedRoute<Params>(readJobApplicationResponse),
  patch: authenticatedRoute<Params>(updateJobApplicationResponse),
  delete: authenticatedRoute<Params>(deleteJobApplicationResponse),
};

/** What Next.js hands a handler on a route with no dynamic segment. */
const noParams = { params: Promise.resolve({}) };

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

afterAll(forgetTestTokens);

afterEach(async () => {
  // No test may assume an empty database, so each one leaves it as it found it.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
});

async function post(user: CurrentUser, body: unknown): Promise<Response> {
  const response = await collection.post(
    new Request(ENDPOINT, {
      method: "POST",
      headers: await bearer(user),
      body: JSON.stringify(body),
    }),
    noParams,
  );

  if (response.status === 201) {
    const created: JobApplication = await response.clone().json();
    saved.push({ userId: user.id, id: created.id });
  }

  return response;
}

/** Creates a Job Application, failing loudly if it could not be created. */
async function save(user: CurrentUser, body: unknown): Promise<JobApplication> {
  const response = await post(user, body);
  expect(response.status).toBe(201);
  return response.json();
}

async function list(user: CurrentUser, query = ""): Promise<Response> {
  return collection.get(
    new Request(`${ENDPOINT}${query}`, { headers: await bearer(user) }),
    noParams,
  );
}

async function patch(
  user: CurrentUser,
  id: string,
  body: unknown,
): Promise<Response> {
  return item.patch(
    new Request(`${ENDPOINT}/${id}`, {
      method: "PATCH",
      headers: await bearer(user),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

async function read(user: CurrentUser, id: string): Promise<Response> {
  return item.get(
    new Request(`${ENDPOINT}/${id}`, { headers: await bearer(user) }),
    { params: Promise.resolve({ id }) },
  );
}

async function remove(user: CurrentUser, id: string): Promise<Response> {
  return item.delete(
    new Request(`${ENDPOINT}/${id}`, {
      method: "DELETE",
      headers: await bearer(user),
    }),
    { params: Promise.resolve({ id }) },
  );
}

/** An id shaped like a Job Application's, belonging to none. */
const NO_SUCH_ID = "00000000-0000-4000-8000-00000000dead";

describe("POST /api/job-applications", () => {
  it("records a Job Application given only a company and a job title", async () => {
    const created = await save(TEST_USER, {
      company: "Vercel",
      jobTitle: "Software Engineer",
    });

    expect(created).toMatchObject({
      userId: TEST_USER.id,
      company: "Vercel",
      jobTitle: "Software Engineer",
      jobUrl: null,
      status: "bookmarked",
      requirements: [],
      appliedAt: null,
    });
    expect(created.id).toEqual(expect.any(String));
  });

  it("keeps the Requirements in the order the Posting asked in", async () => {
    // They are rows of their own now rather than an array in a column, so the
    // order a Posting listed its asks in is something the read has to restore
    // rather than something the storage keeps for free.
    const asked = [
      { skill: "Kubernetes", necessity: "required" },
      { skill: "Terraform", necessity: "preferred" },
      { skill: "German", necessity: "unstated" },
    ] as const;

    const created = await save(TEST_USER, {
      company: "Fly.io",
      jobTitle: "Infrastructure Engineer",
      requirements: asked,
    });

    const reloaded: JobApplication = await (
      await read(TEST_USER, created.id)
    ).json();
    expect(reloaded.requirements).toEqual(asked);
  });

  it("records several Job Applications with no Posting, for referrals and recruiter emails", async () => {
    const referral = await save(TEST_USER, {
      company: "Linear",
      jobTitle: "Product Engineer",
      jobUrl: null,
      source: "referral",
    });
    const recruiterEmail = await save(TEST_USER, {
      company: "Raycast",
      jobTitle: "Frontend Engineer",
      jobUrl: null,
    });

    expect(referral.jobUrl).toBeNull();
    expect(recruiterEmail.jobUrl).toBeNull();
  });

  it("keeps the Posting's URL and the fields sent alongside it", async () => {
    const created = await save(TEST_USER, {
      company: "Supabase",
      jobTitle: "Postgres Engineer",
      jobUrl: "https://supabase.com/careers/postgres-engineer",
      status: "applied",
      location: "Remote",
      remoteType: "remote",
      requirements: [
        { skill: "postgres", necessity: "required" },
        { skill: "typescript", necessity: "preferred" },
      ],
    });

    expect(created).toMatchObject({
      jobUrl: "https://supabase.com/careers/postgres-engineer",
      status: "applied",
      location: "Remote",
      remoteType: "remote",
      requirements: [
        { skill: "postgres", necessity: "required" },
        { skill: "typescript", necessity: "preferred" },
      ],
    });
  });

  it("stamps the applied date when a Job Application is recorded as applied", async () => {
    const created = await save(TEST_USER, {
      company: "Duolingo",
      jobTitle: "Platform Engineer",
      status: "applied",
    });

    expect(created.appliedAt).not.toBeNull();
  });

  it("keeps an applied date the client supplied", async () => {
    const appliedAt = "2026-01-09T09:00:00.000Z";

    const created = await save(TEST_USER, {
      company: "Monzo",
      jobTitle: "Backend Engineer",
      status: "applied",
      appliedAt,
    });

    expect(created.appliedAt).toBe(appliedAt);
  });

  it("leaves the applied date unset until the Job Application is applied for", async () => {
    const created = await save(TEST_USER, {
      company: "Deliveroo",
      jobTitle: "Data Engineer",
    });

    expect(created.appliedAt).toBeNull();
  });

  it("refuses a Job Application with no company", async () => {
    const response = await post(TEST_USER, { jobTitle: "Software Engineer" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining("company")]),
    });
  });

  it("refuses a body that is not JSON", async () => {
    const response = await collection.post(
      new Request(ENDPOINT, {
        method: "POST",
        headers: await bearer(TEST_USER),
        body: "not json",
      }),
      noParams,
    );

    expect(response.status).toBe(400);
  });

  it("refuses a second Job Application for the same Posting, however the URL is parameterised", async () => {
    await save(TEST_USER, {
      company: "Anthropic",
      jobTitle: "Product Engineer",
      jobUrl: "https://anthropic.com/jobs/product-engineer?utm_source=hn",
    });

    const duplicate = await post(TEST_USER, {
      company: "Anthropic",
      jobTitle: "Product Engineer",
      jobUrl: "https://anthropic.com/jobs/product-engineer",
    });

    expect(duplicate.status).toBe(409);
  });

  it("keeps the same role advertised on two sites as two Job Applications", async () => {
    const onTheJobBoard = await save(TEST_USER, {
      company: "Modal",
      jobTitle: "Systems Engineer",
      jobUrl: "https://jobs.example.com/modal/systems-engineer",
    });
    const onTheCareersPage = await save(TEST_USER, {
      company: "Modal",
      jobTitle: "Systems Engineer",
      jobUrl: "https://modal.com/careers/systems-engineer",
    });

    expect(onTheCareersPage.id).not.toBe(onTheJobBoard.id);

    const listed: JobApplication[] = await (await list(TEST_USER)).json();
    expect(listed.map(({ id }) => id)).toEqual(
      expect.arrayContaining([onTheJobBoard.id, onTheCareersPage.id]),
    );
  });

  it("lets a second user save a Posting the first user has already saved", async () => {
    const jobUrl = "https://stripe.com/jobs/staff-engineer";
    await save(TEST_USER, {
      company: "Stripe",
      jobTitle: "Staff Engineer",
      jobUrl,
    });

    const theirs = await post(OTHER_TEST_USER, {
      company: "Stripe",
      jobTitle: "Staff Engineer",
      jobUrl,
    });

    expect(theirs.status).toBe(201);
  });
});

describe("GET /api/job-applications", () => {
  it("returns the caller's Job Applications", async () => {
    const created = await save(TEST_USER, {
      company: "Figma",
      jobTitle: "Design Engineer",
    });

    const response = await list(TEST_USER);
    const jobApplications: JobApplication[] = await response.json();

    expect(response.status).toBe(200);
    expect(jobApplications.map(({ id }) => id)).toContain(created.id);
  });

  it("never returns another user's Job Applications", async () => {
    const mine = await save(TEST_USER, {
      company: "Notion",
      jobTitle: "Backend Engineer",
    });
    const theirs = await save(OTHER_TEST_USER, {
      company: "Ramp",
      jobTitle: "Backend Engineer",
    });

    const forMe: JobApplication[] = await (await list(TEST_USER)).json();
    const forThem: JobApplication[] = await (
      await list(OTHER_TEST_USER)
    ).json();

    expect(forMe.map(({ id }) => id)).toContain(mine.id);
    expect(forMe.map(({ id }) => id)).not.toContain(theirs.id);
    expect(forThem.map(({ id }) => id)).toContain(theirs.id);
    expect(forThem.map(({ id }) => id)).not.toContain(mine.id);
    expect(forMe.every(({ userId }) => userId === TEST_USER.id)).toBe(true);
  });

  it("filters by Status", async () => {
    const applied = await save(TEST_USER, {
      company: "Shopify",
      jobTitle: "Senior Engineer",
      status: "applied",
    });
    const bookmarked = await save(TEST_USER, {
      company: "Shopify",
      jobTitle: "Staff Engineer",
    });

    const ids: string[] = (
      await (await list(TEST_USER, "?status=applied")).json()
    ).map(({ id }: JobApplication) => id);

    expect(ids).toContain(applied.id);
    expect(ids).not.toContain(bookmarked.id);
  });

  it("refuses a Status it does not recognise", async () => {
    const response = await list(TEST_USER, "?status=ghosted");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("ghosted"),
    });
  });

  /**
   * A Posting saved alongside the one being looked up, so that a lookup which
   * quietly ignored its URL would answer with two Job Applications and fail
   * rather than pass by having nothing else to return.
   */
  async function saveAnotherPosting(): Promise<JobApplication> {
    return save(TEST_USER, {
      company: "Some Other Company",
      jobTitle: "Some Other Role",
      jobUrl: `https://example.com/jobs/${crypto.randomUUID()}`,
    });
  }

  async function lookUp(
    user: CurrentUser,
    jobUrl: string,
  ): Promise<JobApplication[]> {
    const response = await list(user, `?url=${encodeURIComponent(jobUrl)}`);
    expect(response.status).toBe(200);
    return response.json();
  }

  it("finds the Job Application saved for a Posting", async () => {
    const jobUrl = "https://linear.app/careers/backend-engineer";
    const created = await save(TEST_USER, {
      company: "Linear",
      jobTitle: "Backend Engineer",
      jobUrl,
    });
    await saveAnotherPosting();

    await expect(lookUp(TEST_USER, jobUrl)).resolves.toMatchObject([
      { id: created.id, company: "Linear", jobTitle: "Backend Engineer" },
    ]);
  });

  it("recognises a Posting saved with tracking parameters when it is reached by a clean URL", async () => {
    const created = await save(TEST_USER, {
      company: "Replit",
      jobTitle: "Infrastructure Engineer",
      jobUrl:
        "https://replit.com/careers/infrastructure-engineer?utm_source=linkedin&trackingId=abc",
    });
    await saveAnotherPosting();

    const found = await lookUp(
      TEST_USER,
      "https://replit.com/careers/infrastructure-engineer",
    );

    expect(found.map(({ id }) => id)).toEqual([created.id]);
  });

  it("recognises a Posting saved by a clean URL when it is reached with tracking parameters", async () => {
    const created = await save(TEST_USER, {
      company: "Neon",
      jobTitle: "Storage Engineer",
      jobUrl: "https://neon.tech/careers/storage-engineer",
    });
    await saveAnotherPosting();

    const found = await lookUp(
      TEST_USER,
      "https://NEON.tech/careers/storage-engineer?ref=hn&utm_medium=email#apply",
    );

    expect(found.map(({ id }) => id)).toEqual([created.id]);
  });

  it("answers with nothing for a Posting that is not saved", async () => {
    await saveAnotherPosting();

    await expect(
      lookUp(TEST_USER, "https://example.com/jobs/never-saved"),
    ).resolves.toEqual([]);
  });

  it("never finds a Posting another user saved", async () => {
    const jobUrl = "https://vercel.com/careers/developer-advocate";
    await save(OTHER_TEST_USER, {
      company: "Vercel",
      jobTitle: "Developer Advocate",
      jobUrl,
    });

    await expect(lookUp(TEST_USER, jobUrl)).resolves.toEqual([]);
  });

  it("never finds a Job Application recorded with no Posting at all", async () => {
    await save(TEST_USER, {
      company: "Ashby",
      jobTitle: "Founding Engineer",
      jobUrl: null,
    });

    await expect(
      lookUp(TEST_USER, "https://ashbyhq.com/careers/founding-engineer"),
    ).resolves.toEqual([]);
  });

  it("refuses a URL lookup that is not a URL", async () => {
    const response = await list(TEST_USER, "?url=example.com/jobs");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("example.com/jobs"),
    });
  });

  it("narrows a URL lookup by Status too", async () => {
    const jobUrl = "https://retool.com/careers/solutions-engineer";
    await save(TEST_USER, {
      company: "Retool",
      jobTitle: "Solutions Engineer",
      jobUrl,
    });

    await saveAnotherPosting();

    const url = encodeURIComponent(jobUrl);

    await expect(
      (await list(TEST_USER, `?url=${url}&status=bookmarked`)).json(),
    ).resolves.toHaveLength(1);
    await expect(
      (await list(TEST_USER, `?url=${url}&status=offer`)).json(),
    ).resolves.toEqual([]);
  });
});

describe("PATCH /api/job-applications/:id", () => {
  it("changes a Job Application's Status", async () => {
    const created = await save(TEST_USER, {
      company: "Cloudflare",
      jobTitle: "Systems Engineer",
    });

    const response = await patch(TEST_USER, created.id, {
      status: "interviewing",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.id,
      status: "interviewing",
    });
  });

  it("keeps a Status change, so it survives a reload", async () => {
    const created = await save(TEST_USER, {
      company: "Sentry",
      jobTitle: "Reliability Engineer",
    });
    await patch(TEST_USER, created.id, { status: "offer" });

    const jobApplications: JobApplication[] = await (
      await list(TEST_USER)
    ).json();

    expect(jobApplications.find(({ id }) => id === created.id)).toMatchObject({
      status: "offer",
    });
  });

  it("stamps the applied date when a Job Application moves to applied", async () => {
    const created = await save(TEST_USER, {
      company: "Fly.io",
      jobTitle: "Infrastructure Engineer",
    });
    expect(created.appliedAt).toBeNull();

    const moved: JobApplication = await (
      await patch(TEST_USER, created.id, { status: "applied" })
    ).json();

    expect(moved.appliedAt).not.toBeNull();
  });

  it("leaves an applied date alone when a Job Application moves to applied again", async () => {
    const appliedAt = "2026-02-14T10:00:00.000Z";
    const created = await save(TEST_USER, {
      company: "Railway",
      jobTitle: "Platform Engineer",
      status: "interviewing",
      appliedAt,
    });

    const moved: JobApplication = await (
      await patch(TEST_USER, created.id, { status: "applied" })
    ).json();

    expect(moved.appliedAt).toBe(appliedAt);
  });

  it.each(["rejected", "withdrawn", "bookmarked"] as const)(
    "never clears the applied date on a move to %s",
    async (status) => {
      const appliedAt = "2026-03-01T12:00:00.000Z";
      const created = await save(TEST_USER, {
        company: `Retool ${status}`,
        jobTitle: "Product Engineer",
        status: "applied",
        appliedAt,
      });

      const moved: JobApplication = await (
        await patch(TEST_USER, created.id, { status })
      ).json();

      expect(moved).toMatchObject({ status, appliedAt });
    },
  );

  it("changes only the fields the patch names", async () => {
    const created = await save(TEST_USER, {
      company: "Grafana",
      jobTitle: "Observability Engineer",
      location: "Stockholm",
      requirements: [
        { skill: "go", necessity: "required" },
        { skill: "prometheus", necessity: "unstated" },
      ],
    });

    const updated: JobApplication = await (
      await patch(TEST_USER, created.id, { notes: "Recruiter call on Friday" })
    ).json();

    expect(updated).toMatchObject({
      company: "Grafana",
      jobTitle: "Observability Engineer",
      location: "Stockholm",
      requirements: [
        { skill: "go", necessity: "required" },
        { skill: "prometheus", necessity: "unstated" },
      ],
      notes: "Recruiter call on Friday",
    });
  });

  it("never changes another user's Job Application", async () => {
    const theirs = await save(OTHER_TEST_USER, {
      company: "Datadog",
      jobTitle: "Backend Engineer",
    });

    const response = await patch(TEST_USER, theirs.id, { status: "offer" });

    expect(response.status).toBe(404);

    const forThem: JobApplication[] = await (
      await list(OTHER_TEST_USER)
    ).json();
    expect(forThem.find(({ id }) => id === theirs.id)).toMatchObject({
      status: "bookmarked",
    });
  });

  it("refuses a Job Application that does not exist", async () => {
    const response = await patch(TEST_USER, NO_SUCH_ID, { status: "offer" });

    expect(response.status).toBe(404);
  });

  it("refuses a Status it does not recognise", async () => {
    const created = await save(TEST_USER, {
      company: "Elastic",
      jobTitle: "Search Engineer",
    });

    const response = await patch(TEST_USER, created.id, { status: "ghosted" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining("status")]),
    });
  });

  it("refuses a body that is not JSON", async () => {
    const created = await save(TEST_USER, {
      company: "Twilio",
      jobTitle: "API Engineer",
    });

    const response = await item.patch(
      new Request(`${ENDPOINT}/${created.id}`, {
        method: "PATCH",
        headers: await bearer(TEST_USER),
        body: "not json",
      }),
      { params: Promise.resolve({ id: created.id }) },
    );

    expect(response.status).toBe(400);
  });

  it("refuses a patch that would duplicate a Posting the user has already saved", async () => {
    const jobUrl = "https://gitlab.com/jobs/staff-engineer";
    await save(TEST_USER, {
      company: "GitLab",
      jobTitle: "Staff Engineer",
      jobUrl,
    });
    const other = await save(TEST_USER, {
      company: "GitLab",
      jobTitle: "Senior Engineer",
      jobUrl: "https://gitlab.com/jobs/senior-engineer",
    });

    const response = await patch(TEST_USER, other.id, {
      jobUrl: `${jobUrl}?utm_source=hn`,
    });

    expect(response.status).toBe(409);
  });

  it("recognises the Posting a patch moved a Job Application to", async () => {
    const created = await save(TEST_USER, {
      company: "Render",
      jobTitle: "Cloud Engineer",
    });

    await patch(TEST_USER, created.id, {
      jobUrl: "https://render.com/careers/cloud-engineer?ref=twitter",
    });

    const duplicate = await post(TEST_USER, {
      company: "Render",
      jobTitle: "Cloud Engineer",
      jobUrl: "https://render.com/careers/cloud-engineer",
    });

    expect(duplicate.status).toBe(409);
  });

  it("edits every field the user owns, and keeps the edits so they survive a reload", async () => {
    const created = await save(TEST_USER, {
      company: "Basecamp",
      jobTitle: "Programmer",
    });

    const edited = {
      company: "37signals",
      jobTitle: "Senior Programmer",
      jobUrl: "https://37signals.com/jobs/senior-programmer",
      location: "Chicago",
      remoteType: "hybrid",
      salaryMin: 120000,
      salaryMax: 160000,
      currency: "USD",
      description: "Works on Basecamp and HEY.",
      requirements: [
        { skill: "ruby", necessity: "required" },
        { skill: "rails", necessity: "preferred" },
      ],
      status: "interviewing",
      source: "referral",
      appliedAt: "2026-04-02T00:00:00.000Z",
      excitement: 4,
      notes: "Second interview on the 9th.",
    } as const;

    const response = await patch(TEST_USER, created.id, edited);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject(edited);

    const reloaded: JobApplication = await (
      await read(TEST_USER, created.id)
    ).json();
    expect(reloaded).toMatchObject(edited);
  });

  it("clears the fields a patch names as empty", async () => {
    const created = await save(TEST_USER, {
      company: "Zapier",
      jobTitle: "Backend Engineer",
      location: "Remote",
      notes: "Applied through a friend.",
      excitement: 5,
    });

    const cleared: JobApplication = await (
      await patch(TEST_USER, created.id, {
        location: null,
        notes: null,
        excitement: null,
        requirements: [],
      })
    ).json();

    expect(cleared).toMatchObject({
      location: null,
      notes: null,
      excitement: null,
      requirements: [],
    });
  });

  it.each([1, 2, 3, 4, 5])("records excitement of %i", async (excitement) => {
    const created = await save(TEST_USER, {
      company: `Airtable ${excitement}`,
      jobTitle: "Product Engineer",
    });

    const updated: JobApplication = await (
      await patch(TEST_USER, created.id, { excitement })
    ).json();

    expect(updated.excitement).toBe(excitement);
  });

  it.each([0, 6, 2.5])(
    "refuses excitement of %s, which is off the one-to-five scale",
    async (excitement) => {
      const created = await save(TEST_USER, {
        company: `Vanta ${excitement}`,
        jobTitle: "Security Engineer",
      });

      const response = await patch(TEST_USER, created.id, { excitement });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        issues: expect.arrayContaining([expect.stringContaining("excitement")]),
      });
    },
  );

  it("backfills an applied date for a Job Application applied for before the tool existed", async () => {
    const created = await save(TEST_USER, {
      company: "Buffer",
      jobTitle: "Full Stack Engineer",
      status: "applied",
    });
    expect(created.appliedAt).not.toBeNull();

    const backfilled: JobApplication = await (
      await patch(TEST_USER, created.id, {
        appliedAt: "2025-11-20T00:00:00.000Z",
      })
    ).json();

    expect(backfilled.appliedAt).toBe("2025-11-20T00:00:00.000Z");
  });

  it("takes the applied date a patch names over the stamp a move to applied would leave", async () => {
    const created = await save(TEST_USER, {
      company: "Doist",
      jobTitle: "Backend Engineer",
    });

    const moved: JobApplication = await (
      await patch(TEST_USER, created.id, {
        status: "applied",
        appliedAt: "2025-09-15T00:00:00.000Z",
      })
    ).json();

    expect(moved).toMatchObject({
      status: "applied",
      appliedAt: "2025-09-15T00:00:00.000Z",
    });
  });
});

describe("GET /api/job-applications/:id", () => {
  it("returns every field of a Job Application", async () => {
    const created = await save(TEST_USER, {
      company: "Postman",
      jobTitle: "API Engineer",
      jobUrl: "https://postman.com/careers/api-engineer",
      location: "Bangalore",
      remoteType: "onsite",
      salaryMin: 40000,
      salaryMax: 60000,
      currency: "INR",
      description: "Owns the collection runner.",
      requirements: [
        { skill: "node", necessity: "required" },
        { skill: "api", necessity: "unstated" },
      ],
      status: "applied",
      source: "LinkedIn",
      excitement: 3,
      notes: "Take-home due Monday.",
    });

    const response = await read(TEST_USER, created.id);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(created);
  });

  it("never returns another user's Job Application", async () => {
    const theirs = await save(OTHER_TEST_USER, {
      company: "Intercom",
      jobTitle: "Product Engineer",
    });

    const response = await read(TEST_USER, theirs.id);

    expect(response.status).toBe(404);
  });

  it("refuses a Job Application that does not exist", async () => {
    const response = await read(TEST_USER, NO_SUCH_ID);

    expect(response.status).toBe(404);
  });

  it("refuses an id that could never be a Job Application's", async () => {
    const response = await read(TEST_USER, "not-a-uuid");

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/job-applications/:id", () => {
  it("removes a Job Application, and it stays gone", async () => {
    const created = await save(TEST_USER, {
      company: "Loom",
      jobTitle: "Video Engineer",
    });

    const response = await remove(TEST_USER, created.id);

    expect(response.status).toBe(204);
    expect((await read(TEST_USER, created.id)).status).toBe(404);

    const jobApplications: JobApplication[] = await (
      await list(TEST_USER)
    ).json();
    expect(jobApplications.map(({ id }) => id)).not.toContain(created.id);
  });

  it("takes the Job Application's Requirements with it", async () => {
    // Observed through what a Posting saved again at the same URL comes back
    // with: were the old rows still there, they would attach themselves to the
    // new Job Application or collide with its own.
    const posting = "https://sentry.io/careers/relay-engineer";
    const created = await save(TEST_USER, {
      company: "Sentry",
      jobTitle: "Relay Engineer",
      jobUrl: posting,
      requirements: [{ skill: "Rust", necessity: "required" }],
    });
    await remove(TEST_USER, created.id);

    const again = await save(TEST_USER, {
      company: "Sentry",
      jobTitle: "Relay Engineer",
      jobUrl: posting,
    });

    expect(again.requirements).toEqual([]);
  });

  it("refuses to delete the same Job Application twice", async () => {
    const created = await save(TEST_USER, {
      company: "Miro",
      jobTitle: "Canvas Engineer",
    });
    await remove(TEST_USER, created.id);

    const again = await remove(TEST_USER, created.id);

    expect(again.status).toBe(404);
  });

  it("never deletes another user's Job Application", async () => {
    const theirs = await save(OTHER_TEST_USER, {
      company: "Amplitude",
      jobTitle: "Data Engineer",
    });

    const response = await remove(TEST_USER, theirs.id);

    expect(response.status).toBe(404);
    expect((await read(OTHER_TEST_USER, theirs.id)).status).toBe(200);
  });

  it("refuses a Job Application that does not exist", async () => {
    const response = await remove(TEST_USER, NO_SUCH_ID);

    expect(response.status).toBe(404);
  });
});

describe("reaching the API as the extension does", () => {
  it("answers a Bearer Personal Access Token, with no session anywhere", async () => {
    const created = await save(TEST_USER, {
      company: "Tailscale",
      jobTitle: "Network Engineer",
    });

    const response = await list(TEST_USER);

    expect(response.status).toBe(200);
    const listed: JobApplication[] = await response.json();
    expect(listed.map(({ id }) => id)).toContain(created.id);
  });

  it("refuses a request whose token has been revoked", async () => {
    const { token, revoke } = await issueTestToken(TEST_USER, "Lost laptop");
    await revoke();

    const response = await collection.get(
      new Request(ENDPOINT, { headers: { authorization: `Bearer ${token}` } }),
      noParams,
    );

    expect(response.status).toBe(401);
  });

  it("refuses a token that was never issued", async () => {
    const response = await collection.get(
      new Request(ENDPOINT, { headers: { authorization: "Bearer jbt_nope" } }),
      noParams,
    );

    expect(response.status).toBe(401);
  });
});
