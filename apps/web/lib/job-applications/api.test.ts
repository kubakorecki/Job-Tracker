import type { JobApplication } from "@repo/schema";
import { afterEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "../auth/current-user";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  createJobApplicationResponse,
  listJobApplicationsResponse,
} from "./api";
import { deleteJobApplication } from "./repository";

/**
 * These run against the dev Supabase project (ADR-0003), serially, as the two
 * fixed test users. Every assertion is about what a client can see — a status
 * code, a response body — never about how it was produced. The one query they
 * make is the delete that takes their own rows away again.
 */

const ENDPOINT = "https://job-tracker.test/api/job-applications";

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

afterEach(async () => {
  // No test may assume an empty database, so each one leaves it as it found it.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
});

async function post(user: CurrentUser, body: unknown): Promise<Response> {
  const response = await createJobApplicationResponse(
    new Request(ENDPOINT, { method: "POST", body: JSON.stringify(body) }),
    user,
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
  return listJobApplicationsResponse(new Request(`${ENDPOINT}${query}`), user);
}

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
      keywords: [],
      appliedAt: null,
    });
    expect(created.id).toEqual(expect.any(String));
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
      keywords: ["postgres", "typescript"],
    });

    expect(created).toMatchObject({
      jobUrl: "https://supabase.com/careers/postgres-engineer",
      status: "applied",
      location: "Remote",
      remoteType: "remote",
      keywords: ["postgres", "typescript"],
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
    const response = await createJobApplicationResponse(
      new Request(ENDPOINT, { method: "POST", body: "not json" }),
      TEST_USER,
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
});
