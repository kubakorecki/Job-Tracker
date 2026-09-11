import {
  ExtractJobRequest,
  type ExtractJobResponse,
  type JobExtraction,
} from "@repo/schema";
import { AI_USAGE_LIMIT_STATUS, mayStartAiCall } from "../ai-usage/meter";
import { tokensSpentBy, type Metered } from "../ai-usage/metered";
import { recordAiUsage } from "../ai-usage/repository";
import { jsonBody } from "../api/request";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import { todayInUtc } from "../day";
import { MODEL_CALL_LIMIT_STATUS, spendModelCall } from "../model-calls/budget";
import { describeIssues } from "../zod-issues";
import { extractWithGemini, type ExtractJob } from "./provider";

/**
 * The extraction endpoint, as a plain request-to-response function like the
 * rest of the API — except that it is built by a factory, because the thing a
 * test substitutes here is not the user but the provider.
 */

/**
 * How much of a page the provider is shown. Taken from the front rather than
 * by hunting for a main-content region: a Posting's body reliably sits near
 * the top, and every heuristic for finding it is one more thing that can be
 * wrong on a site nobody tested against.
 */
export const MAX_PAGE_TEXT_LENGTH = 30_000;

/**
 * `POST /api/extract-job`. Answers with the extraction union and never with a
 * bare Draft: an empty Draft and a successful reading of a page with no job on
 * it are the same bytes, and the panel has to tell them apart to know whether
 * to apologise.
 *
 * Two of the four failures answer 200, because the panel's right response to
 * them is to open the manual form. The two that are limits answer their own
 * limit status, because neither is answered by filling the form in now:
 * `ai_usage_spent` is the month's allowance gone, and `rate_limited` is the
 * daily Model Call ceiling, which the user should never see (ADR-0009).
 *
 * The extraction function is substitutable so the endpoint can be exercised
 * with no API key and no network; nothing but a test ever passes one.
 */
export function extractJobResponse(extract: ExtractJob = extractWithGemini) {
  return async (request: Request, user: CurrentUser): Promise<Response> => {
    const read = await jsonBody(request);
    if ("refusal" in read) return read.refusal;

    const input = ExtractJobRequest.safeParse(read.body);
    if (!input.success) {
      return errorResponse(
        "That is not a page to extract from.",
        400,
        describeIssues(input.error),
      );
    }

    // The month's AI Usage, asked before the reading starts and never again: a
    // page cannot be priced until it has been read, so a reading admitted here
    // is allowed to finish and overshoot (ADR-0009). The sentence the user is
    // shown is the panel's, from this reason — the shared one is for the
    // endpoints that answer in prose.
    if ((await mayStartAiCall(user.id)) === "over-limit") {
      return json(
        { ok: false, reason: "ai_usage_spent" },
        AI_USAGE_LIMIT_STATUS,
      );
    }

    // Spent from the one daily count every model call comes out of. Here
    // rather than lower down so that a request refused above costs nothing at
    // all; `spendModelCall` explains the rest.
    if ((await spendModelCall(user.id)) === "over-limit") {
      return json(
        { ok: false, reason: "rate_limited" },
        MODEL_CALL_LIMIT_STATUS,
      );
    }

    let call: Metered<JobExtraction>;
    try {
      call = await extract({
        url: input.data.url,
        pageText: input.data.pageText.slice(0, MAX_PAGE_TEXT_LENGTH),
        // The day the reading is made on, read from the clock here rather than
        // taken from the request: a page states a Closing Date the way a person
        // reads one — "do 24 wrz" — and the year that completes it is the
        // server's fact, not something a client's clock should get to decide.
        today: todayInUtc(),
      });
    } catch (error) {
      // Every way of failing to reach or understand the provider — an outage,
      // an exhausted quota, a malformed reply — is the same answer here. There
      // is deliberately no second attempt on a cheaper model: a visible failure
      // is how the user learns the grant is spent.
      //
      // One of those ways still costs tokens: a provider that answered with
      // something unreadable was paid for answering. `tokensSpentBy` is nought
      // for all the others (ADR-0009).
      await recordAiUsage(user.id, tokensSpentBy(error));
      return json({ ok: false, reason: "provider_error" });
    }

    // What the reading cost. A reading that never reached the provider records
    // nothing and has still spent its Model Call, which is why that one is
    // charged before the provider is reached (ADR-0009).
    await recordAiUsage(user.id, call.tokens);

    const draft = call.answer;

    // A Posting always names at least one of the two. Neither means the page
    // was not a Posting, which is a real answer rather than an error.
    if (isBlank(draft.company) && isBlank(draft.jobTitle)) {
      return json({ ok: false, reason: "no_job_found" });
    }

    return json({ ok: true, draft });
  };
}

/**
 * Whether the Draft says nothing here. The rule lives in the endpoint rather
 * than in a provider so that "the page does not say" means the same thing
 * whichever provider answered — an absent field and a blank one alike.
 */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/** Typed so a variant that is not in the contract cannot be answered with. */
function json(body: ExtractJobResponse, status = 200): Response {
  return Response.json(body, { status });
}
