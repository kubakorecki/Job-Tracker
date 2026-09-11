import type {
  JobApplication,
  JobStatus,
  Requirement,
  RequirementWithCoverage,
} from "@repo/schema";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_USAGE_LIMIT_STATUS,
  MONTHLY_AI_USAGE_LIMIT,
} from "../ai-usage/meter";
import { UnreadableAnswer } from "../ai-usage/metered";
import {
  aiUsageSoFar,
  forgetAiUsage,
  setAiUsage,
} from "../ai-usage/repository";
import { authenticatedRoute } from "../api/authenticated-route";
import type { CurrentUser } from "../auth/current-user";
import { setOverriddenCoverage } from "../coverage/repository";
import {
  createJobApplicationResponse,
  readJobApplicationResponse,
  updateJobApplicationResponse,
} from "../job-applications/api";
import { deleteJobApplication } from "../job-applications/repository";
import {
  DAILY_MODEL_CALL_LIMIT,
  MODEL_CALL_LIMIT_STATUS,
} from "../model-calls/budget";
import { forgetModelCalls, setModelCallCount } from "../model-calls/repository";
import {
  bearer,
  forgetTestTokens,
} from "../test-support/personal-access-tokens";
import {
  forgetTestProfiles,
  giveProfileSkills,
} from "../test-support/profiles";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import type {
  AnalysedReading,
  AnalyseCoverage,
  AnalysisOutcome,
  AnalysisRequest,
} from "./analyser";
import { readAnalysisResponse, runAnalysisResponse } from "./api";
import type { Analysis, AnalysisOrNone, AnalysisResult } from "./contract";

/**
 * The Analysis, exercised the way the rest of the backend is: through the
 * endpoint, against the dev Supabase project (ADR-0003), asserting only what a
 * client can see.
 *
 * No API key and no network — the analyser is substituted at the function the
 * endpoint was built around, and a stand-in that keeps what it was handed is
 * how "the model was shown the CV's prose and every Requirement" is asserted
 * without reaching a provider.
 *
 * Both limits are real rows in the real tables, as they are in the Profile's
 * tests, because what a run costs the user is half of why this endpoint is its
 * own module — the daily Model Call count that caps a leaked token, and the
 * month of AI Usage that is the only spending the user is ever shown
 * (ADR-0009).
 */

const JOB_APPLICATIONS = "https://job-tracker.test/api/job-applications";

const analysisOf = (id: string) => `${JOB_APPLICATIONS}/${id}/analysis`;

type Params = { id: string };

/** The routes, assembled exactly as their `route.ts` assembles them. */
const jobApplications = {
  post: authenticatedRoute(createJobApplicationResponse),
  get: authenticatedRoute<Params>(readJobApplicationResponse),
  patch: authenticatedRoute<Params>(updateJobApplicationResponse),
};

const analyses = { get: authenticatedRoute<Params>(readAnalysisResponse) };

const noParams = { params: Promise.resolve({}) };

/** What the Profile says, in the prose an Analysis reads rather than a list. */
const CV_TEXT = [
  "Jane Doe — Senior Engineer",
  "Acme (2022–2026): TypeScript, React, Postgres.",
  "Four years of React across two roles.",
].join("\n");

/** The skills the user accepted, so the automatic comparison has spoken too. */
const SKILLS = ["TypeScript", "Postgres"];

/** What one Posting asks for, in the order the model is shown them. */
const REACT: Requirement = {
  skill: "5+ years of React",
  necessity: "required",
};
const KUBERNETES: Requirement = { skill: "Kubernetes", necessity: "preferred" };
const ASKED = [REACT, KUBERNETES];

/** What the stand-in makes of each, unless a test wants something else. */
const REACT_PARTIAL: AnalysedReading = {
  index: 0,
  coverage: "partial",
  reason: "Four years of React across two roles, against the five asked for.",
};
const KUBERNETES_MISSING: AnalysedReading = {
  index: 1,
  coverage: "missing",
  reason: "The CV does not mention Kubernetes.",
};
const READ_BOTH = [REACT_PARTIAL, KUBERNETES_MISSING];

/** The overall opinion the stand-in gives, unless a test wants something else. */
const RATING = 6;
const FEEDBACK = "Quantify the React experience and add Kubernetes work.";

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

afterAll(forgetTestTokens);

/** What the fake analyser reports having spent, thinking included. */
const TOKENS = 18_400;

beforeEach(async () => {
  for (const user of [TEST_USER, OTHER_TEST_USER]) {
    await forgetModelCalls(user.id);
    await forgetAiUsage(user.id);
  }
  await giveProfileSkills(TEST_USER, SKILLS, CV_TEXT);
});

afterEach(async () => {
  // Taking the Job Application away takes its Requirements and its Analysis
  // with it, which is the cascade the schema promises.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
  await forgetTestProfiles(TEST_USER, OTHER_TEST_USER);
});

/**
 * A stand-in for the model that answers as the test says, and keeps what it
 * was asked. An `Error` means the provider could not be reached or understood,
 * which is its one way of failing.
 */
type FakeAnalyser = { analyse: AnalyseCoverage; asked: AnalysisRequest[] };

function analysing(
  reply: AnalysedReading[] | Error,
  outcome: Pick<AnalysisOutcome, "rating" | "feedback"> = {
    rating: RATING,
    feedback: FEEDBACK,
  },
): FakeAnalyser {
  const asked: AnalysisRequest[] = [];

  return {
    asked,
    analyse: async (request) => {
      asked.push(request);
      if (reply instanceof Error) throw reply;
      return { answer: { readings: reply, ...outcome }, tokens: TOKENS };
    },
  };
}

/** A Job Application with the Requirements given, ready to be analysed. */
async function save(
  user: CurrentUser,
  requirements: Requirement[] = ASKED,
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

/** Asks for an Analysis, with the model standing in as the caller says. */
async function run(
  user: CurrentUser,
  id: string,
  analyser: FakeAnalyser = analysing(READ_BOTH),
): Promise<Response> {
  return authenticatedRoute<Params>(runAnalysisResponse(analyser.analyse))(
    new Request(analysisOf(id), {
      method: "POST",
      headers: await bearer(user),
    }),
    { params: Promise.resolve({ id }) },
  );
}

/** What the last Analysis of one Job Application reads as. */
async function read(user: CurrentUser, id: string): Promise<Response> {
  return analyses.get(
    new Request(analysisOf(id), { headers: await bearer(user) }),
    { params: Promise.resolve({ id }) },
  );
}

/** The same, as the value a client would hold. */
async function analysisOfOne(
  user: CurrentUser,
  id: string,
): Promise<AnalysisOrNone> {
  return (await read(user, id)).json();
}

/** The Analysis as a client that knows one has run would hold it. */
async function ranAnalysis(user: CurrentUser, id: string): Promise<Analysis> {
  const analysis = await analysisOfOne(user, id);
  if (analysis === null) throw new Error("No Analysis has run.");
  return analysis;
}

/** One Job Application's Requirements, asked for again. */
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

/** A patch, as the detail page and the board both send one. */
async function patch(
  user: CurrentUser,
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await jobApplications.patch(
    new Request(`${JOB_APPLICATIONS}/${id}`, {
      method: "PATCH",
      headers: await bearer(user),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

  expect(response.status).toBe(200);
}

/** The first Requirement of a Job Application, which every test here has. */
function first(jobApplication: JobApplication): RequirementWithCoverage {
  const [requirement] = jobApplication.requirements;
  if (requirement === undefined) throw new Error("Nothing was asked for.");
  return requirement;
}

describe("running an Analysis", () => {
  it("answers with a verdict and a reason for every Requirement", async () => {
    const { id } = await save(TEST_USER);

    const response = await run(TEST_USER, id);

    expect(response.status).toBe(200);
    const result: AnalysisResult = await response.json();
    expect(result.requirements).toMatchObject([
      {
        skill: REACT.skill,
        coverage: "partial",
        analysedCoverage: "partial",
        analysedReason: REACT_PARTIAL.reason,
      },
      {
        skill: KUBERNETES.skill,
        coverage: "missing",
        analysedCoverage: "missing",
        analysedReason: KUBERNETES_MISSING.reason,
      },
    ]);
    expect(result.analysis.stale).toBe(false);
    expect(result.analysis.rating).toBe(RATING);
    expect(result.analysis.feedback).toBe(FEEDBACK);
  });

  it("keeps the rating and feedback, so reopening the Job Application shows them again", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    await expect(ranAnalysis(TEST_USER, id)).resolves.toMatchObject({
      rating: RATING,
      feedback: FEEDBACK,
    });
  });

  it("replaces the rating and feedback on a re-run", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    await run(
      TEST_USER,
      id,
      analysing(READ_BOTH, { rating: 9, feedback: "Now add Terraform." }),
    );

    await expect(ranAnalysis(TEST_USER, id)).resolves.toMatchObject({
      rating: 9,
      feedback: "Now add Terraform.",
    });
  });

  it("answers `partial`, which is the reading the whole feature exists for", async () => {
    // Four years against a stated five. A string comparison can only say the
    // Posting's wording is absent from the list, which is a different claim.
    const { id } = await save(TEST_USER, [REACT]);

    const response = await run(TEST_USER, id, analysing([REACT_PARTIAL]));

    const result: AnalysisResult = await response.json();
    expect(result.requirements).toMatchObject([{ coverage: "partial" }]);
  });

  it("supersedes the normalised reading, which stays readable underneath", async () => {
    // The comparison read "Postgres" straight off the accepted list; the model
    // is reading the CV, and where it speaks it is the higher of the two.
    const { id } = await save(TEST_USER, [
      { skill: "Postgres", necessity: "required" },
    ]);

    const response = await run(
      TEST_USER,
      id,
      analysing([
        {
          index: 0,
          coverage: "partial",
          reason: "Named in a stack list, with no project behind it.",
        },
      ]),
    );

    const result: AnalysisResult = await response.json();
    expect(result.requirements).toMatchObject([
      {
        coverage: "partial",
        analysedCoverage: "partial",
        // Both readings are kept, so a surprising badge can say what the
        // automatic comparison saw as well as what the model concluded.
        normalisedCoverage: "have",
      },
    ]);
  });

  it("leaves an override standing above what the model said", async () => {
    const jobApplication = await save(TEST_USER, [REACT]);
    await setOverriddenCoverage(
      TEST_USER.id,
      jobApplication.id,
      first(jobApplication).id,
      "have",
    );

    const response = await run(
      TEST_USER,
      jobApplication.id,
      analysing([REACT_PARTIAL]),
    );

    const result: AnalysisResult = await response.json();
    expect(result.requirements).toMatchObject([
      {
        coverage: "have",
        analysedCoverage: "partial",
        overriddenCoverage: "have",
      },
    ]);
  });

  it("shows the model the CV's prose and every Requirement it asks about", async () => {
    const analyser = analysing(READ_BOTH);
    const { id } = await save(TEST_USER);

    await run(TEST_USER, id, analyser);

    expect(analyser.asked).toEqual([{ cvText: CV_TEXT, requirements: ASKED }]);
  });

  it("keeps the result, so reopening the Job Application spends nothing", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    await expect(reload(TEST_USER, id)).resolves.toMatchObject([
      { analysedCoverage: "partial", analysedReason: REACT_PARTIAL.reason },
      {
        analysedCoverage: "missing",
        analysedReason: KUBERNETES_MISSING.reason,
      },
    ]);
    // Reading it back reached no provider: the run is what spent a call.
    await expect(analysisOfOne(TEST_USER, id)).resolves.not.toBe(null);
  });

  it("leaves a Requirement the model said nothing about as it was", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    await run(
      TEST_USER,
      id,
      analysing([
        { index: 0, coverage: "have", reason: "The CV now shows five years." },
      ]),
    );

    await expect(reload(TEST_USER, id)).resolves.toMatchObject([
      { analysedCoverage: "have" },
      { analysedCoverage: "missing" },
    ]);
  });

  it("refuses a Job Application that records no Requirements", async () => {
    const { id } = await save(TEST_USER, []);
    const analyser = analysing(READ_BOTH);

    const response = await run(TEST_USER, id, analyser);

    expect(response.status).toBe(422);
    // Nothing to read is nothing to spend a model call on.
    expect(analyser.asked).toEqual([]);
  });

  it("refuses to run for a user with no CV to read", async () => {
    await forgetTestProfiles(TEST_USER);
    const { id } = await save(TEST_USER);
    const analyser = analysing(READ_BOTH);

    const response = await run(TEST_USER, id, analyser);

    expect(response.status).toBe(422);
    expect(analyser.asked).toEqual([]);
  });

  it("answers a Job Application that does not exist the way every endpoint does", async () => {
    expect((await run(TEST_USER, crypto.randomUUID())).status).toBe(404);
    expect((await run(TEST_USER, "not-a-uuid")).status).toBe(404);
  });
});

describe("when the model cannot be reached", () => {
  it("says so, and not what a spent allowance says", async () => {
    const { id } = await save(TEST_USER);

    const response = await run(
      TEST_USER,
      id,
      analysing(new Error("The provider is down.")),
    );

    expect(response.status).toBe(502);
    expect(response.status).not.toBe(MODEL_CALL_LIMIT_STATUS);
  });

  it("leaves the previous Analysis exactly as it was", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);
    const before = await ranAnalysis(TEST_USER, id);

    await run(TEST_USER, id, analysing(new Error("The provider is down.")));

    await expect(analysisOfOne(TEST_USER, id)).resolves.toEqual(before);
    await expect(reload(TEST_USER, id)).resolves.toMatchObject([
      { analysedCoverage: "partial" },
      { analysedCoverage: "missing" },
    ]);
  });

  it("records nothing for a reply that answered about no Requirement", async () => {
    const { id } = await save(TEST_USER);

    const response = await run(TEST_USER, id, analysing([]));

    expect(response.status).toBe(502);
    await expect(analysisOfOne(TEST_USER, id)).resolves.toBe(null);
  });
});

describe("when the model gives no usable rating", () => {
  it("still records the readings, with the rating and feedback left null", async () => {
    // A bad overall opinion is not the same failure as an unreadable reply
    // about the Requirements: the readings the model did get right are not
    // thrown away for it (analyser.ts's `readOutcome`).
    const { id } = await save(TEST_USER);

    const response = await run(
      TEST_USER,
      id,
      analysing(READ_BOTH, { rating: null, feedback: null }),
    );

    expect(response.status).toBe(200);
    const result: AnalysisResult = await response.json();
    expect(result.requirements).toMatchObject([
      { analysedCoverage: "partial" },
      { analysedCoverage: "missing" },
    ]);
    expect(result.analysis.rating).toBe(null);
    expect(result.analysis.feedback).toBe(null);
  });
});

describe("the daily model call budget", () => {
  it("spends one model call per run", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 2);
    const { id } = await save(TEST_USER);

    expect((await run(TEST_USER, id)).status).toBe(200);
    expect((await run(TEST_USER, id)).status).toBe(200);
    expect((await run(TEST_USER, id)).status).toBe(MODEL_CALL_LIMIT_STATUS);
  });

  it("refuses before the provider is reached once the allowance is spent", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    const { id } = await save(TEST_USER);
    const analyser = analysing(READ_BOTH);

    const response = await run(TEST_USER, id, analyser);

    expect(response.status).toBe(MODEL_CALL_LIMIT_STATUS);
    expect(analyser.asked).toEqual([]);
  });

  it("leaves the previous Analysis alone when the allowance runs out", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);
    const before = await ranAnalysis(TEST_USER, id);

    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    expect((await run(TEST_USER, id)).status).toBe(MODEL_CALL_LIMIT_STATUS);

    await expect(analysisOfOne(TEST_USER, id)).resolves.toEqual(before);
  });

  it("spends nothing on a run it refused before reaching the model", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 1);
    const nothingAsked = await save(TEST_USER, [], "Grafana");
    expect((await run(TEST_USER, nothingAsked.id)).status).toBe(422);

    // The one remaining model call is still there to spend.
    const { id } = await save(TEST_USER, ASKED, "Fly.io");
    expect((await run(TEST_USER, id)).status).toBe(200);
  });

  it("counts each user's runs separately", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    const mine = await save(TEST_USER);
    await giveProfileSkills(OTHER_TEST_USER, SKILLS, CV_TEXT);
    const theirs = await save(OTHER_TEST_USER, ASKED, "Linear");

    expect((await run(TEST_USER, mine.id)).status).toBe(
      MODEL_CALL_LIMIT_STATUS,
    );
    expect((await run(OTHER_TEST_USER, theirs.id)).status).toBe(200);
  });
});

describe("whether an Analysis still stands", () => {
  it("says nothing has run where nothing has", async () => {
    const { id } = await save(TEST_USER);

    const response = await read(TEST_USER, id);

    expect(response.status).toBe(200);
    expect(await response.json()).toBe(null);
  });

  it("goes stale when the Profile changes under it", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    // A re-uploaded CV and an edited skill list are the same news to an
    // Analysis: what it read is not what is there now.
    await giveProfileSkills(TEST_USER, [...SKILLS, "Kubernetes"], CV_TEXT);

    await expect(ranAnalysis(TEST_USER, id)).resolves.toMatchObject({
      stale: true,
    });
  });

  it("goes stale when the Requirements change under it", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    await patch(TEST_USER, id, {
      requirements: [...ASKED, { skill: "Terraform", necessity: "required" }],
    });

    await expect(ranAnalysis(TEST_USER, id)).resolves.toMatchObject({
      stale: true,
    });
  });

  it("does not go stale because the user overrode a verdict", async () => {
    // An override writes the Requirement row. An Analysis marked stale for
    // that reason would be asking for a model call because its own answer was
    // overruled, which is the opposite of what ADR-0004 promises.
    const jobApplication = await save(TEST_USER);
    await run(TEST_USER, jobApplication.id);

    await setOverriddenCoverage(
      TEST_USER.id,
      jobApplication.id,
      first(jobApplication).id,
      "have",
    );

    await expect(
      ranAnalysis(TEST_USER, jobApplication.id),
    ).resolves.toMatchObject({ stale: false });
  });

  it("stands again once it has been re-run", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);
    await giveProfileSkills(TEST_USER, [...SKILLS, "Kubernetes"], CV_TEXT);

    await run(TEST_USER, id);

    await expect(ranAnalysis(TEST_USER, id)).resolves.toMatchObject({
      stale: false,
    });
  });

  it.each(["bookmarked", "applied"] as const)(
    "still says so while the Status is %s",
    async (status: JobStatus) => {
      const { id } = await staleUnder(status);

      await expect(ranAnalysis(TEST_USER, id)).resolves.toMatchObject({
        stale: true,
      });
    },
  );

  it.each(["interviewing", "offer", "rejected", "withdrawn"] as const)(
    "keeps quiet once the Status is %s",
    async (status: JobStatus) => {
      // Past applying there is nothing to be done about a CV that has moved
      // on, so the tracker stops asking for a model call about it.
      const { id } = await staleUnder(status);

      await expect(ranAnalysis(TEST_USER, id)).resolves.toMatchObject({
        stale: false,
      });
    },
  );

  it("answers a Job Application that does not exist the way every endpoint does", async () => {
    expect((await read(TEST_USER, crypto.randomUUID())).status).toBe(404);
    expect((await read(TEST_USER, "not-a-uuid")).status).toBe(404);
  });
});

describe("whose Analysis it is", () => {
  it("never lets one user analyse another's Job Application", async () => {
    const { id } = await save(TEST_USER);
    const analyser = analysing(READ_BOTH);

    const response = await run(OTHER_TEST_USER, id, analyser);

    expect(response.status).toBe(404);
    expect(analyser.asked).toEqual([]);
    await expect(analysisOfOne(TEST_USER, id)).resolves.toBe(null);
  });

  it("never lets one user read another's Analysis", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    expect((await read(OTHER_TEST_USER, id)).status).toBe(404);
  });

  it("reads each user's own CV and nobody else's", async () => {
    await giveProfileSkills(OTHER_TEST_USER, ["Go"], "Sam Patel — Go, Kafka.");
    const theirs = await save(OTHER_TEST_USER, ASKED, "Linear");
    const analyser = analysing(READ_BOTH);

    await run(OTHER_TEST_USER, theirs.id, analyser);

    expect(analyser.asked).toEqual([
      { cvText: "Sam Patel — Go, Kafka.", requirements: ASKED },
    ]);
  });
});

/**
 * A Job Application whose Analysis has been overtaken by a change to the
 * Profile, sitting at the Status given. Whether the user is told about it is
 * the whole of what the two tests above differ on.
 */
async function staleUnder(status: JobStatus): Promise<JobApplication> {
  const jobApplication = await save(TEST_USER);
  await run(TEST_USER, jobApplication.id);
  await giveProfileSkills(TEST_USER, [...SKILLS, "Kubernetes"], CV_TEXT);
  await patch(TEST_USER, jobApplication.id, { status });

  return jobApplication;
}

describe("the month's AI Usage", () => {
  it("records what a run cost, thinking included", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);

    expect(await aiUsageSoFar(TEST_USER.id)).toBe(TOKENS);
  });

  it("records nothing for a run that never reached the provider", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id, analysing(new Error("503")));

    // The Model Call is spent — it is charged before the provider is reached —
    // and AI Usage is not, because the provider never said what it cost
    // (ADR-0009).
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(0);
  });

  it("records what a reply it could not read had already cost", async () => {
    const { id } = await save(TEST_USER);
    await run(
      TEST_USER,
      id,
      analysing(new UnreadableAnswer(TOKENS, "not JSON")),
    );

    // The model answered and was paid for answering; only a call that fails
    // before the provider answers is free (ADR-0009).
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(TOKENS);
  });

  it("refuses the run before the provider once the month is spent", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    const { id } = await save(TEST_USER);
    const analyser = analysing(READ_BOTH);

    const response = await run(TEST_USER, id, analyser);

    expect(response.status).toBe(AI_USAGE_LIMIT_STATUS);
    expect(analyser.asked).toEqual([]);
  });

  it("says the month is done, not that something went wrong", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    const { id } = await save(TEST_USER);

    const { error } = await (await run(TEST_USER, id)).json();

    // Two limits, two refusals, and they do not read the same: this one is an
    // ordinary allowance ending and says when it comes back (ADR-0009).
    expect(error).toContain("month");
  });

  it("leaves the previous Analysis alone when the month runs out", async () => {
    const { id } = await save(TEST_USER);
    await run(TEST_USER, id);
    const before = await ranAnalysis(TEST_USER, id);

    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    expect((await run(TEST_USER, id)).status).toBe(AI_USAGE_LIMIT_STATUS);

    await expect(analysisOfOne(TEST_USER, id)).resolves.toEqual(before);
  });

  it("lets a run admitted within the limit finish and overshoot it", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT - 1);
    const { id } = await save(TEST_USER);

    // Admitted on the budget it had before it started, and priced only once it
    // had answered — which is the whole of ADR-0009's consequence.
    expect((await run(TEST_USER, id)).status).toBe(200);
    expect(await aiUsageSoFar(TEST_USER.id)).toBeGreaterThan(
      MONTHLY_AI_USAGE_LIMIT,
    );
    expect((await run(TEST_USER, id)).status).toBe(AI_USAGE_LIMIT_STATUS);
  });
});
