import type {
  Coverage,
  JobApplication,
  Requirement,
  RequirementWithCoverage,
} from "@repo/schema";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticatedRoute } from "../api/authenticated-route";
import type { CurrentUser } from "../auth/current-user";
import {
  createJobApplicationResponse,
  readJobApplicationResponse,
} from "../job-applications/api";
import { deleteJobApplication } from "../job-applications/repository";
import { giveAnalysedCoverage } from "../test-support/analysis";
import {
  bearer,
  forgetTestTokens,
} from "../test-support/personal-access-tokens";
import {
  forgetTestProfiles,
  giveProfileSkills,
} from "../test-support/profiles";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  clearCoverageOverrideResponse,
  setCoverageOverrideResponse,
} from "./api";

/**
 * The user's last word about one Requirement, exercised the way the rest of
 * the backend is: through the endpoint, against the dev Supabase project
 * (ADR-0003), asserting only what a client can see.
 *
 * What is being proved here is a precedence rather than a write. An override
 * has to beat the automatic comparison and the Analysis, has to survive the
 * Analysis being run again, and has to leave both of them intact underneath so
 * that clearing it puts back whatever it was hiding (ADR-0004).
 */

const JOB_APPLICATIONS = "https://job-tracker.test/api/job-applications";

const coverageOf = (id: string, requirementId: string) =>
  `${JOB_APPLICATIONS}/${id}/requirements/${requirementId}/coverage`;

/** The route, assembled exactly as its `route.ts` assembles it. */
type Params = { id: string; requirementId: string };

const override = {
  put: authenticatedRoute<Params>(setCoverageOverrideResponse),
  delete: authenticatedRoute<Params>(clearCoverageOverrideResponse),
};

const jobApplications = {
  post: authenticatedRoute(createJobApplicationResponse),
  get: authenticatedRoute<{ id: string }>(readJobApplicationResponse),
};

const noParams = { params: Promise.resolve({}) };

/** The skills the user has accepted, so the automatic comparison has spoken. */
const SKILLS = ["TypeScript", "Postgres"];

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

afterAll(forgetTestTokens);

beforeEach(() => giveProfileSkills(TEST_USER, SKILLS));

afterEach(async () => {
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
  await forgetTestProfiles(TEST_USER);
});

/** A Job Application with the Requirements given, ready to be overridden. */
async function save(
  user: CurrentUser,
  requirements: Requirement[],
  company = "Vercel",
): Promise<JobApplication> {
  const response = await jobApplications.post(
    new Request(JOB_APPLICATIONS, {
      method: "POST",
      headers: await bearer(user),
      body: JSON.stringify({
        company,
        jobTitle: "Platform Engineer",
        requirements,
      }),
    }),
    noParams,
  );

  expect(response.status).toBe(201);
  const created: JobApplication = await response.json();
  saved.push({ userId: user.id, id: created.id });
  return created;
}

/** One Requirement the user's CV does not mention, on its Job Application. */
async function asked(
  skill = "Kubernetes",
  company = "Vercel",
): Promise<{
  jobApplication: JobApplication;
  requirement: RequirementWithCoverage;
}> {
  const jobApplication = await save(
    TEST_USER,
    [{ skill, necessity: "required" }],
    company,
  );
  const [requirement] = jobApplication.requirements;
  if (requirement === undefined) throw new Error("Nothing was asked for.");
  return { jobApplication, requirement };
}

async function put(
  user: CurrentUser,
  ids: Params,
  body: unknown,
): Promise<Response> {
  return override.put(
    new Request(coverageOf(ids.id, ids.requirementId), {
      method: "PUT",
      headers: await bearer(user),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve(ids) },
  );
}

async function clear(user: CurrentUser, ids: Params): Promise<Response> {
  return override.delete(
    new Request(coverageOf(ids.id, ids.requirementId), {
      method: "DELETE",
      headers: await bearer(user),
    }),
    { params: Promise.resolve(ids) },
  );
}

/** What one Job Application's Requirements read as, asked for again. */
async function reload(
  user: CurrentUser,
  id: string,
): Promise<RequirementWithCoverage[]> {
  const response = await jobApplications.get(
    new Request(`${JOB_APPLICATIONS}/${id}`, { headers: await bearer(user) }),
    { params: Promise.resolve({ id }) },
  );
  const reloaded: JobApplication = await response.json();
  return reloaded.requirements;
}

describe("setting an override", () => {
  it.each(["have", "partial", "missing"] as const)(
    "records %s as the user's own word",
    async (coverage: Coverage) => {
      const { jobApplication, requirement } = await asked();

      const response = await put(
        TEST_USER,
        { id: jobApplication.id, requirementId: requirement.id },
        { coverage },
      );

      expect(response.status).toBe(200);
      const overridden: RequirementWithCoverage = await response.json();
      expect(overridden).toMatchObject({
        id: requirement.id,
        skill: "Kubernetes",
        coverage,
        overriddenCoverage: coverage,
      });
      await expect(reload(TEST_USER, jobApplication.id)).resolves.toMatchObject(
        [{ coverage, overriddenCoverage: coverage }],
      );
    },
  );

  it("beats the automatic comparison", async () => {
    // The comparison read the skill straight off the accepted list; the user
    // says otherwise, and the user has the last word.
    const { jobApplication, requirement } = await asked("TypeScript");
    expect(requirement.coverage).toBe("have");

    const response = await put(
      TEST_USER,
      { id: jobApplication.id, requirementId: requirement.id },
      { coverage: "partial" },
    );

    const overridden: RequirementWithCoverage = await response.json();
    expect(overridden).toMatchObject({
      coverage: "partial",
      // Both losing readings stay readable, which is what lets the badge say
      // why it reads as it does rather than only what it reads as.
      normalisedCoverage: "have",
      overriddenCoverage: "partial",
    });
  });

  it("beats the Analysis", async () => {
    const { jobApplication, requirement } = await asked();
    await giveAnalysedCoverage(TEST_USER, requirement.id, {
      coverage: "partial",
      reason: "Two years against the five asked for.",
    });

    const response = await put(
      TEST_USER,
      { id: jobApplication.id, requirementId: requirement.id },
      { coverage: "have" },
    );

    expect(await response.json()).toMatchObject({
      coverage: "have",
      analysedCoverage: "partial",
      analysedReason: "Two years against the five asked for.",
      overriddenCoverage: "have",
    });
  });

  it("survives the Analysis being run again", async () => {
    // The Analysis writes the analysed reading and only that, so a re-run
    // cannot reach the column the user's word lives in.
    const { jobApplication, requirement } = await asked();
    await put(
      TEST_USER,
      { id: jobApplication.id, requirementId: requirement.id },
      { coverage: "have" },
    );

    await giveAnalysedCoverage(TEST_USER, requirement.id, {
      coverage: "missing",
      reason: "The CV does not mention it.",
    });

    await expect(reload(TEST_USER, jobApplication.id)).resolves.toMatchObject([
      {
        coverage: "have",
        analysedCoverage: "missing",
        overriddenCoverage: "have",
      },
    ]);
  });

  it("changes its mind when it is set again", async () => {
    const { jobApplication, requirement } = await asked();
    const ids = { id: jobApplication.id, requirementId: requirement.id };

    await put(TEST_USER, ids, { coverage: "have" });
    const response = await put(TEST_USER, ids, { coverage: "partial" });

    expect(await response.json()).toMatchObject({
      coverage: "partial",
      overriddenCoverage: "partial",
    });
  });

  it("applies to the one Job Application it was set on", async () => {
    // Two Postings asking for the same thing. Saying "I have this" about one
    // of them is a decision about that application, not about the skill.
    const one = await asked("Kubernetes", "Grafana");
    const another = await asked("Kubernetes", "Fly.io");

    await put(
      TEST_USER,
      { id: one.jobApplication.id, requirementId: one.requirement.id },
      { coverage: "have" },
    );

    await expect(
      reload(TEST_USER, another.jobApplication.id),
    ).resolves.toMatchObject([
      { coverage: "missing", overriddenCoverage: null },
    ]);
  });

  it("refuses a Coverage that is not one of the three", async () => {
    const { jobApplication, requirement } = await asked();

    const response = await put(
      TEST_USER,
      { id: jobApplication.id, requirementId: requirement.id },
      { coverage: "probably" },
    );

    expect(response.status).toBe(400);
  });

  it("refuses a body that states no Coverage at all", async () => {
    const { jobApplication, requirement } = await asked();

    const response = await put(
      TEST_USER,
      { id: jobApplication.id, requirementId: requirement.id },
      {},
    );

    expect(response.status).toBe(400);
  });
});

describe("clearing an override", () => {
  it("falls back to the Analysis where one has run", async () => {
    const { jobApplication, requirement } = await asked();
    const ids = { id: jobApplication.id, requirementId: requirement.id };
    await giveAnalysedCoverage(TEST_USER, requirement.id, {
      coverage: "partial",
      reason: "Mentioned once, in passing.",
    });
    await put(TEST_USER, ids, { coverage: "have" });

    const response = await clear(TEST_USER, ids);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      coverage: "partial",
      overriddenCoverage: null,
    });
  });

  it("falls back to the automatic comparison where no Analysis has run", async () => {
    const { jobApplication, requirement } = await asked("TypeScript");
    const ids = { id: jobApplication.id, requirementId: requirement.id };
    await put(TEST_USER, ids, { coverage: "missing" });

    const response = await clear(TEST_USER, ids);

    expect(await response.json()).toMatchObject({
      coverage: "have",
      normalisedCoverage: "have",
      overriddenCoverage: null,
    });
    await expect(reload(TEST_USER, jobApplication.id)).resolves.toMatchObject([
      { coverage: "have", overriddenCoverage: null },
    ]);
  });

  it("says nothing was read where nothing else has spoken", async () => {
    // A user with no Profile has no automatic reading either, so taking the
    // override back leaves the Requirement unread rather than missing.
    await forgetTestProfiles(TEST_USER);
    const { jobApplication, requirement } = await asked();
    const ids = { id: jobApplication.id, requirementId: requirement.id };
    await put(TEST_USER, ids, { coverage: "have" });

    const response = await clear(TEST_USER, ids);

    expect(await response.json()).toMatchObject({
      coverage: null,
      overriddenCoverage: null,
    });
  });

  it("is harmless where there was no override to take back", async () => {
    const { jobApplication, requirement } = await asked("TypeScript");

    const response = await clear(TEST_USER, {
      id: jobApplication.id,
      requirementId: requirement.id,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ coverage: "have" });
  });
});

describe("whose Requirement it is", () => {
  it("never lets one user override another's Requirement", async () => {
    const { jobApplication, requirement } = await asked();

    const response = await put(
      OTHER_TEST_USER,
      { id: jobApplication.id, requirementId: requirement.id },
      { coverage: "have" },
    );

    expect(response.status).toBe(404);
    await expect(reload(TEST_USER, jobApplication.id)).resolves.toMatchObject([
      { coverage: "missing", overriddenCoverage: null },
    ]);
  });

  it("never lets one user clear another's override", async () => {
    const { jobApplication, requirement } = await asked();
    const ids = { id: jobApplication.id, requirementId: requirement.id };
    await put(TEST_USER, ids, { coverage: "have" });

    const response = await clear(OTHER_TEST_USER, ids);

    expect(response.status).toBe(404);
    await expect(reload(TEST_USER, jobApplication.id)).resolves.toMatchObject([
      { coverage: "have", overriddenCoverage: "have" },
    ]);
  });

  it("refuses a Requirement belonging to another Job Application", async () => {
    // The address names both, so a Requirement reached through the wrong Job
    // Application is not found rather than quietly overridden.
    const one = await asked("Kubernetes", "Grafana");
    const another = await asked("Kubernetes", "Fly.io");

    const response = await put(
      TEST_USER,
      {
        id: another.jobApplication.id,
        requirementId: one.requirement.id,
      },
      { coverage: "have" },
    );

    expect(response.status).toBe(404);
  });

  it("answers an id that could never be a Requirement the same way", async () => {
    const { jobApplication } = await asked();

    const response = await put(
      TEST_USER,
      { id: jobApplication.id, requirementId: "not-a-uuid" },
      { coverage: "have" },
    );

    expect(response.status).toBe(404);
  });

  it("answers an id that could never be a Job Application the same way", async () => {
    const { requirement } = await asked();

    const response = await put(
      TEST_USER,
      { id: "not-a-uuid", requirementId: requirement.id },
      { coverage: "have" },
    );

    expect(response.status).toBe(404);
  });
});
