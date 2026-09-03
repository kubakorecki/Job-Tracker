import {
  ExtractJobResponse,
  type JobExtraction,
  type ExtractJobRequest,
} from "@repo/schema";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "../auth/current-user";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  DAILY_EXTRACTION_LIMIT,
  MAX_PAGE_TEXT_LENGTH,
  extractJobRoute,
} from "./api";
import type { ExtractionRequest, ExtractJob } from "./provider";
import { forgetExtractionUsage, setExtractionCount } from "./repository";

/**
 * The extraction endpoint as its only caller sees it: what the panel gets back
 * for a Posting, for a page that is not one, for a provider that is down, and
 * for a user who has spent the day's allowance.
 *
 * No API key and no network. The provider is substituted at the extraction
 * function — the seam the endpoint was built around — so a fake standing in
 * for Gemini also lets the test read what the endpoint decided to send it,
 * which is how truncation is asserted without inspecting anything private.
 *
 * The daily counter is a real row in the real table, cleared around each test:
 * it is the one part of this endpoint that has to survive a request.
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
  keywords: ["TypeScript", "Postgres"],
};

beforeEach(clearCounters);
afterAll(clearCounters);

async function clearCounters(): Promise<void> {
  await forgetExtractionUsage(TEST_USER.id);
  await forgetExtractionUsage(OTHER_TEST_USER.id);
}

/**
 * A stand-in for Gemini that answers as the test says, and keeps what it was
 * asked. An `Error` means the provider could not be reached or understood,
 * which is the only way the real one fails.
 */
type FakeProvider = { extract: ExtractJob; asked: ExtractionRequest[] };

function answering(reply: JobExtraction | Error): FakeProvider {
  const asked: ExtractionRequest[] = [];

  return {
    asked,
    extract: async (request) => {
      asked.push(request);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
}

async function extract(
  user: CurrentUser,
  body: unknown,
  provider: FakeProvider = answering(DRAFT),
): Promise<Response> {
  return extractJobRoute(provider.extract)(
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

  it("sends the provider the URL and the page text it was given", async () => {
    const provider = answering(DRAFT);
    await extract(TEST_USER, POSTING, provider);

    expect(provider.asked).toEqual([
      { url: POSTING.url, pageText: POSTING.pageText },
    ]);
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
      answering({ description: "An article about hiring.", keywords: [] }),
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
    const response = await extractJobRoute(answering(DRAFT).extract)(
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

describe("the daily extraction limit", () => {
  it("spends one extraction per request, and no more", async () => {
    await setExtractionCount(TEST_USER.id, DAILY_EXTRACTION_LIMIT - 2);

    expect((await extract(TEST_USER, POSTING)).status).toBe(200);
    expect((await extract(TEST_USER, POSTING)).status).toBe(200);
    expect((await extract(TEST_USER, POSTING)).status).toBe(429);
  });

  it("spends the extraction a provider failure cost anyway", async () => {
    await setExtractionCount(TEST_USER.id, DAILY_EXTRACTION_LIMIT - 1);
    await extract(TEST_USER, POSTING, answering(new Error("503")));

    // The request reached the provider, so it counted — whatever came back.
    expect((await extract(TEST_USER, POSTING)).status).toBe(429);
  });

  it("refuses the request after the limit, telling the panel to wait", async () => {
    await setExtractionCount(TEST_USER.id, DAILY_EXTRACTION_LIMIT);
    const response = await extract(TEST_USER, POSTING);

    expect(response.status).toBe(429);
    expect(await unionOf(response)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("does not call the provider once the limit is reached", async () => {
    await setExtractionCount(TEST_USER.id, DAILY_EXTRACTION_LIMIT);
    const provider = answering(DRAFT);
    await extract(TEST_USER, POSTING, provider);

    expect(provider.asked).toEqual([]);
  });

  it("counts each user's extractions separately", async () => {
    await setExtractionCount(TEST_USER.id, DAILY_EXTRACTION_LIMIT);

    expect((await extract(TEST_USER, POSTING)).status).toBe(429);
    expect((await extract(OTHER_TEST_USER, POSTING)).status).toBe(200);
  });

  it("spends nothing on a request it refused as invalid", async () => {
    await setExtractionCount(TEST_USER.id, DAILY_EXTRACTION_LIMIT - 1);
    await extract(TEST_USER, { url: POSTING.url });

    // The one remaining extraction is still there to spend.
    expect((await extract(TEST_USER, POSTING)).status).toBe(200);
  });
});
