import {
  ExtractJobRequest,
  ExtractJobResponse,
  type JobExtraction,
} from "@repo/schema";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  AI_USAGE_LIMIT_STATUS,
  MONTHLY_AI_USAGE_LIMIT,
} from "../ai-usage/meter";
import {
  aiUsageSoFar,
  forgetAiUsage,
  setAiUsage,
} from "../ai-usage/repository";
import type { CurrentUser } from "../auth/current-user";
import { todayInUtc } from "../day";
import {
  DAILY_MODEL_CALL_LIMIT,
  MODEL_CALL_LIMIT_STATUS,
} from "../model-calls/budget";
import { forgetModelCalls, setModelCallCount } from "../model-calls/repository";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import { MAX_PAGE_TEXT_LENGTH, extractJobResponse } from "./api";
import type { ExtractJob, PostingToRead } from "./provider";

/**
 * The extraction endpoint as its only caller sees it: what the panel gets back
 * for a Posting, for a page that is not one, for a provider that is down, for
 * a user whose month of AI Usage is spent, and for one who has hit the daily
 * Model Call ceiling.
 *
 * No API key and no network. The provider is substituted at the extraction
 * function — the seam the endpoint was built around — so a fake standing in
 * for Gemini also lets the test read what the endpoint decided to send it,
 * which is how truncation is asserted without inspecting anything private.
 *
 * Both limits are real rows in the real tables, cleared around each test: they
 * are the parts of this endpoint that have to survive a request. What they are
 * and how they are spent lives in `lib/model-calls` and `lib/ai-usage`, tested
 * there; what is asserted here is only what this endpoint does with a spent
 * one, and that a reading's tokens reach the meter at all.
 */

const ENDPOINT = "https://job-tracker.test/api/extract-job";

const POSTING: ExtractJobRequest = {
  url: "https://jobs.example.com/engineer-42",
  pageText: "Senior Engineer at Acme. London. £90,000–£110,000.",
};

/** What a good extraction looks like coming back from the provider. */
const DRAFT: JobExtraction = {
  company: "Acme",
  jobTitle: "Senior Engineer",
  location: "London",
  remoteType: "hybrid",
  salaryMin: 90_000,
  salaryMax: 110_000,
  currency: "GBP",
  description: "Building things at Acme.",
  requirements: [
    { skill: "TypeScript", necessity: "required" as const },
    { skill: "Postgres", necessity: "required" as const },
    { skill: "Terraform", necessity: "preferred" as const },
    { skill: "Agile", necessity: "unstated" as const },
  ],
};

/** What the fake provider reports having spent, prompt and thinking included. */
const TOKENS = 15_200;

beforeEach(clearCounters);
afterAll(clearCounters);

async function clearCounters(): Promise<void> {
  for (const user of [TEST_USER, OTHER_TEST_USER]) {
    await forgetModelCalls(user.id);
    await forgetAiUsage(user.id);
  }
}

/**
 * A stand-in for Gemini that answers as the test says, and keeps what it was
 * asked. An `Error` means the provider could not be reached or understood,
 * which is the only way the real one fails.
 */
type FakeProvider = { extract: ExtractJob; asked: PostingToRead[] };

function answering(reply: JobExtraction | Error): FakeProvider {
  const asked: PostingToRead[] = [];

  return {
    asked,
    extract: async (request) => {
      asked.push(request);
      if (reply instanceof Error) throw reply;
      return { answer: reply, tokens: TOKENS };
    },
  };
}

async function extract(
  user: CurrentUser,
  body: unknown,
  provider: FakeProvider = answering(DRAFT),
): Promise<Response> {
  return extractJobResponse(provider.extract)(
    new Request(ENDPOINT, { method: "POST", body: JSON.stringify(body) }),
    user,
  );
}

/** The body, having first insisted it is one of the shapes the contract allows. */
async function unionOf(response: Response): Promise<ExtractJobResponse> {
  return ExtractJobResponse.parse(await response.json());
}

describe("POST /api/extract-job", () => {
  it("answers a Posting with the Draft the provider read from it", async () => {
    const response = await extract(TEST_USER, POSTING);

    expect(response.status).toBe(200);
    expect(await unionOf(response)).toEqual({ ok: true, draft: DRAFT });
  });

  it("carries every Requirement the provider read, each with its Necessity", async () => {
    const response = await extract(TEST_USER, POSTING);

    expect(await unionOf(response)).toMatchObject({
      draft: { requirements: DRAFT.requirements },
    });
  });

  it("carries a Posting's Requirements through unstated when it never said how badly it wanted them", async () => {
    const asked = { skill: "Terraform", necessity: "unstated" as const };
    const response = await extract(
      TEST_USER,
      POSTING,
      answering({
        company: "Acme",
        jobTitle: "Engineer",
        requirements: [asked],
      }),
    );

    expect(await unionOf(response)).toEqual({
      ok: true,
      draft: { company: "Acme", jobTitle: "Engineer", requirements: [asked] },
    });
  });

  it("answers a Posting that asks for nothing with a Draft and no Requirements", async () => {
    // "Nothing asked" is a Posting like any other; only an empty company and
    // title mean the page was not one.
    const response = await extract(
      TEST_USER,
      POSTING,
      answering({ company: "Acme", jobTitle: "Engineer" }),
    );

    expect(response.status).toBe(200);
    expect(await unionOf(response)).toEqual({
      ok: true,
      draft: { company: "Acme", jobTitle: "Engineer" },
    });
  });

  it("sends the provider the URL and the page text it was given", async () => {
    const provider = answering(DRAFT);
    await extract(TEST_USER, POSTING, provider);

    expect(provider.asked).toEqual([
      { url: POSTING.url, pageText: POSTING.pageText, today: todayInUtc() },
    ]);
  });

  it("tells the provider what day the reading is being made on", async () => {
    // The day is the endpoint's to state, not the client's: a Posting names a
    // Closing Date the way a person reads one — "do 24 wrz" — and without a
    // day to complete it the model supplies a year of its own, which is how a
    // Posting closing in a fortnight was once recorded as closing in 2024.
    const provider = answering(DRAFT);
    await extract(TEST_USER, { ...POSTING, today: "1999-01-01" }, provider);

    expect(provider.asked[0]?.today).toBe(todayInUtc());
  });

  it("truncates a long page from the front before sending it", async () => {
    const provider = answering(DRAFT);
    const pageText = `${"the posting".padEnd(MAX_PAGE_TEXT_LENGTH, ".")}and everything after`;

    await extract(TEST_USER, { ...POSTING, pageText }, provider);

    const sent = provider.asked[0]?.pageText ?? "";
    expect(sent).toHaveLength(MAX_PAGE_TEXT_LENGTH);
    expect(sent).toBe(pageText.slice(0, MAX_PAGE_TEXT_LENGTH));
  });

  it("sends a page shorter than the limit whole", async () => {
    const provider = answering(DRAFT);
    await extract(TEST_USER, POSTING, provider);

    expect(provider.asked[0]?.pageText).toBe(POSTING.pageText);
  });

  it("says no job was found when company and title both came back empty", async () => {
    const response = await extract(
      TEST_USER,
      POSTING,
      answering({ description: "An article about hiring.", requirements: [] }),
    );

    expect(response.status).toBe(200);
    expect(await unionOf(response)).toEqual({
      ok: false,
      reason: "no_job_found",
    });
  });

  it("says no job was found for a wholly empty Draft", async () => {
    const response = await extract(TEST_USER, POSTING, answering({}));

    expect(await unionOf(response)).toEqual({
      ok: false,
      reason: "no_job_found",
    });
  });

  it("keeps a Draft that has a company but no title", async () => {
    const response = await extract(
      TEST_USER,
      POSTING,
      answering({ company: "Acme" }),
    );

    expect(await unionOf(response)).toEqual({
      ok: true,
      draft: { company: "Acme" },
    });
  });

  it("reports a provider failure as one, with a 200 so the panel can offer manual entry", async () => {
    const response = await extract(
      TEST_USER,
      POSTING,
      answering(new Error("503 Service Unavailable")),
    );

    expect(response.status).toBe(200);
    expect(await unionOf(response)).toEqual({
      ok: false,
      reason: "provider_error",
    });
  });

  it("reports an exhausted quota as a provider failure rather than answering from elsewhere", async () => {
    const response = await extract(
      TEST_USER,
      POSTING,
      answering(new Error("429 RESOURCE_EXHAUSTED: quota exceeded")),
    );

    expect(response.status).toBe(200);
    expect(await unionOf(response)).toEqual({
      ok: false,
      reason: "provider_error",
    });
  });

  it("refuses a body that is not an extraction request", async () => {
    const response = await extract(TEST_USER, { url: "not a url" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining("url")]),
    });
  });

  it("refuses a body that is not JSON at all", async () => {
    const response = await extractJobResponse(answering(DRAFT).extract)(
      new Request(ENDPOINT, { method: "POST", body: "not json" }),
      TEST_USER,
    );

    expect(response.status).toBe(400);
  });

  it("does not ask the provider about a request it refused", async () => {
    const provider = answering(DRAFT);
    await extract(TEST_USER, { pageText: "" }, provider);

    expect(provider.asked).toEqual([]);
  });
});

describe("the daily model call budget", () => {
  it("spends one model call per request, and no more", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 2);

    expect((await extract(TEST_USER, POSTING)).status).toBe(200);
    expect((await extract(TEST_USER, POSTING)).status).toBe(200);
    expect((await extract(TEST_USER, POSTING)).status).toBe(
      MODEL_CALL_LIMIT_STATUS,
    );
  });

  it("spends the model call a provider failure cost anyway", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 1);
    await extract(TEST_USER, POSTING, answering(new Error("503")));

    // The request reached the provider, so it counted — whatever came back.
    expect((await extract(TEST_USER, POSTING)).status).toBe(
      MODEL_CALL_LIMIT_STATUS,
    );
  });

  it("refuses the request after the limit, telling the panel to wait", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    const response = await extract(TEST_USER, POSTING);

    // The literal, once, on purpose: every other assertion here compares the
    // shared constant with itself, which would stay green if the status moved.
    // The panel is already written against 429, so this is the one that has to
    // hold whatever `lib/model-calls` calls it.
    expect(response.status).toBe(429);
    expect(MODEL_CALL_LIMIT_STATUS).toBe(429);
    expect(await unionOf(response)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("does not call the provider once the limit is reached", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    const provider = answering(DRAFT);
    await extract(TEST_USER, POSTING, provider);

    expect(provider.asked).toEqual([]);
  });

  it("counts each user's model calls separately", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);

    expect((await extract(TEST_USER, POSTING)).status).toBe(
      MODEL_CALL_LIMIT_STATUS,
    );
    expect((await extract(OTHER_TEST_USER, POSTING)).status).toBe(200);
  });

  it("spends nothing on a request it refused as invalid", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 1);
    await extract(TEST_USER, { url: POSTING.url });

    // The one remaining model call is still there to spend.
    expect((await extract(TEST_USER, POSTING)).status).toBe(200);
  });
});

describe("the month's AI Usage", () => {
  it("records what a reading cost, thinking included", async () => {
    await extract(TEST_USER, POSTING);

    expect(await aiUsageSoFar(TEST_USER.id)).toBe(TOKENS);
  });

  it("adds one reading to the next", async () => {
    await extract(TEST_USER, POSTING);
    await extract(TEST_USER, POSTING);

    expect(await aiUsageSoFar(TEST_USER.id)).toBe(TOKENS * 2);
  });

  it("records nothing for a reading that never reached the provider", async () => {
    await extract(TEST_USER, POSTING, answering(new Error("503")));

    // The Model Call is spent — it is charged before the provider is reached —
    // and AI Usage is not, because the provider never said what anything cost
    // (ADR-0009).
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(0);
  });

  it("refuses the reading once the month's allowance is spent", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    const provider = answering(DRAFT);
    const response = await extract(TEST_USER, POSTING, provider);

    expect(response.status).toBe(AI_USAGE_LIMIT_STATUS);
    expect(await unionOf(response)).toEqual({
      ok: false,
      reason: "ai_usage_spent",
    });
    // A reason of its own, not the daily ceiling's: a spent month and a
    // runaway client ask different things of the user (ADR-0009).
    expect(provider.asked).toEqual([]);
  });

  it("spends no model call on a reading the month's allowance refused", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 1);
    await extract(TEST_USER, POSTING);

    await forgetAiUsage(TEST_USER.id);

    // The one remaining model call is still there to spend.
    expect((await extract(TEST_USER, POSTING)).status).toBe(200);
  });

  it("gives each user their own allowance", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);

    expect((await extract(TEST_USER, POSTING)).status).toBe(
      AI_USAGE_LIMIT_STATUS,
    );
    expect((await extract(OTHER_TEST_USER, POSTING)).status).toBe(200);
  });
});
