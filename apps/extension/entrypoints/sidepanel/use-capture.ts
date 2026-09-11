import type {
  CreateJobApplication,
  ExtractionFailureReason,
} from "@repo/schema";
import { useState } from "react";
import {
  extractJob,
  saveJobApplication,
  type ExtractOutcome,
} from "../../lib/api";
import { emptyFields, fieldsFrom, type DraftFields } from "../../lib/draft";
import { readActivePosting } from "../../lib/page";
import type { Settings } from "../../lib/settings";

/**
 * Capturing the Posting in front of the user: read the tab, ask what it says,
 * put the answer in front of them to correct, and record what they confirm.
 * Until they do there is only a Draft, which is never persisted
 * (`CONTEXT.md`) — this hook holds it, and the endpoint never sees one.
 */

/**
 * Where the capture has got to. Every way extraction can come back short lands
 * the user in the same review form with the boxes empty and a line saying why,
 * because the form is what they were reaching for anyway. The single exception
 * is the daily limit: a form would suggest the panel could still fill it in,
 * and the only remedy there is to wait.
 */
export type Capture =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "reviewing"; fields: DraftFields; explanation: string | null }
  | { kind: "unavailable"; problems: string[] }
  | { kind: "token-rejected" };

/**
 * Why a review form opened with nothing in it. Each is written so that the
 * next thing to do is in the sentence: none of them is a mistake the user can
 * correct, and all of them leave manual entry as the way forward.
 */
const EXPLANATIONS: Record<ExtractionFailureReason, string> = {
  no_job_found:
    "There is no job posting on this page, or none that could be read as one. Fill in what you know, or cancel.",
  provider_error:
    "The extraction service is unavailable, so nothing could be filled in for you. Enter the details by hand, or cancel and try again later.",
  rate_limited:
    "This account has made an unusual number of requests today and has been stopped as a precaution. If that was not you, revoke this token in the dashboard — or add the job by hand now.",
  ai_usage_spent:
    "You have spent this month's AI Usage, so nothing could be read for you. It starts again on the first of next month — add the job by hand until then.",
};

export function useCapture(
  settings: Settings | null,
  /**
   * Called when a Job Application lands. The panel reads the recent list
   * through the same endpoint it writes to, so a successful save leaves that
   * list one record out of date and nothing else would tell it.
   */
  onSaved: () => void,
): {
  capture: Capture;
  extract: () => Promise<void>;
  addManually: () => void;
  cancel: () => void;
  save: (input: CreateJobApplication) => Promise<string[]>;
} {
  const [capture, setCapture] = useState<Capture>({ kind: "idle" });

  return {
    capture,

    extract: async () => {
      if (settings === null) return;

      setCapture({ kind: "working" });

      // Read before asked. A tab that cannot be read costs no extraction — the
      // grant is spent by the endpoint the moment it is called — so finding
      // out here is finding out for free.
      const posting = await readActivePosting();
      if (posting.kind === "unreadable") {
        setCapture(review(emptyFields(), posting.url, posting.problem));
        return;
      }

      setCapture(
        captureFrom(
          await extractJob(settings, {
            url: posting.url,
            pageText: posting.pageText,
          }),
          posting.url,
        ),
      );
    },

    addManually: () => {
      setCapture({
        kind: "reviewing",
        fields: emptyFields(),
        explanation: null,
      });
    },

    cancel: () => {
      setCapture({ kind: "idle" });
    },

    // Takes what the contract already accepted, not the boxes it came from:
    // the form is where text becomes a Job Application, and doing it twice
    // would mean two places could disagree about what the user typed.
    save: async (input) => {
      if (settings === null) return [];

      const outcome = await saveJobApplication(settings, input);

      switch (outcome.kind) {
        case "failed":
          return outcome.problems;

        // Leaves the review form behind for the panel's one account of a token
        // that no longer works, which is the only place carrying a way out.
        case "token-rejected":
          setCapture({ kind: "token-rejected" });
          return [];

        case "saved":
          setCapture({ kind: "idle" });
          onSaved();
          return [];
      }
    },
  };
}

/** What the panel does with each answer the extraction endpoint can give. */
function captureFrom(outcome: ExtractOutcome, url: string): Capture {
  switch (outcome.kind) {
    case "extracted":
      return {
        kind: "reviewing",
        fields: fieldsFrom(outcome.draft, url),
        explanation: null,
      };

    // The two limits are the reasons that do not open a form: a form would
    // suggest the panel could still fill it in, and nothing the user does now
    // changes either answer. They are said where the button is, with manual
    // entry still beside them — and they are said differently, because a spent
    // month and a precaution against a stolen token are not the same news
    // (ADR-0009).
    case "not-extracted":
      return outcome.reason === "rate_limited" ||
        outcome.reason === "ai_usage_spent"
        ? { kind: "unavailable", problems: [EXPLANATIONS[outcome.reason]] }
        : review(emptyFields(), url, EXPLANATIONS[outcome.reason]);

    case "token-rejected":
      return { kind: "token-rejected" };

    case "failed":
      return { kind: "unavailable", problems: outcome.problems };
  }
}

/**
 * A review form opened with an explanation over it. The Posting's URL is
 * carried in even when nothing else could be — it is the one field the panel
 * knows without asking anybody, and the reason a saved Job Application can be
 * reopened at its advertisement later.
 */
function review(
  fields: DraftFields,
  url: string | null,
  explanation: string,
): Capture {
  return {
    kind: "reviewing",
    fields: { ...fields, jobUrl: url ?? "" },
    explanation,
  };
}
