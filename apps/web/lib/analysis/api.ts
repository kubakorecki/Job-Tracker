import type { JobApplication } from "@repo/schema";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import type { AnalysedRequirement } from "../coverage/repository";
import { isJobApplicationId } from "../job-applications/api";
import {
  getJobApplication,
  requirementsFor,
} from "../job-applications/repository";
import { MODEL_CALL_LIMIT_STATUS, spendModelCall } from "../model-calls/budget";
import { getProfile } from "../profile/repository";
import {
  analyseWithGemini,
  type AnalysedReading,
  type AnalyseCoverage,
  type AnalysisOutcome,
} from "./analyser";
import type { AnalysisResult } from "./contract";
import { recordAnalysis } from "./repository";
import { readAnalysis } from "./view";

/**
 * The Analysis endpoints: the deeper reading the user asks for on one Job
 * Application, and what came of the last one.
 *
 * Its own module and its own route rather than another pair of handlers on the
 * Job Application, because the Analysis is the one thing here that may one day
 * be sold: an entitlement check has exactly one door to sit behind, and
 * nothing about running one is reachable through an endpoint that also does
 * something free. Nothing in this cut knows about plans or tiers — the shape
 * is the whole of the provision.
 *
 * One Job Application at a time. There is deliberately no address that runs an
 * Analysis over a list: the user is spending model calls, and a control that
 * spends an unknown number of them at once is not one they can weigh.
 */

/**
 * How much of a CV the provider is shown. A CV is a few pages, so this is
 * reached only by a document that is something else; taking the front of it is
 * the same decision extraction makes about a page, for the same reason — every
 * heuristic for finding the part that matters is one more thing that can be
 * wrong on a document nobody tested against.
 */
export const MAX_CV_TEXT_LENGTH = 30_000;

/** Which Job Application is being read. */
export type AnalysisParams = { id: string };

/**
 * `POST /api/job-applications/:id/analysis`. Reads this Job Application's
 * Requirements against the Profile's prose and records what the model made of
 * each one.
 *
 * Only when asked. Nothing runs this on a schedule, on a save, or on opening
 * the page: it costs a model call from the user's daily allowance, and the
 * stored result is what makes reopening the Job Application free.
 *
 * A run writes only the analysed reading of each Requirement, so an override
 * stands whatever the model says, and a Requirement the model did not answer
 * about keeps whatever the last run said (ADR-0004).
 *
 * The analyser is substitutable so the endpoint can be exercised with no API
 * key and no network; nothing but a test ever passes one.
 */
export function runAnalysisResponse(
  analyse: AnalyseCoverage = analyseWithGemini,
) {
  return async (
    _request: Request,
    user: CurrentUser,
    { id }: AnalysisParams,
  ): Promise<Response> => {
    if (!isJobApplicationId(id)) return notFound();

    const jobApplication = await getJobApplication(user.id, id);
    if (jobApplication === null) return notFound();

    const requirements = jobApplication.requirements;
    if (requirements.length === 0) {
      return errorResponse(
        "There is nothing to analyse: this Job Application records no Requirements.",
        422,
      );
    }

    // The CV's own prose, which is what an Analysis is for: the accepted skill
    // list is what the normalised comparison already read, and asking the
    // model to read it again would spend a call to repeat a string match.
    const profile = await getProfile(user.id);
    const cvText = profile?.extractedText.trim() ?? "";
    if (cvText === "") {
      return errorResponse(
        "There is no CV to analyse against. Upload one to your Profile first.",
        422,
      );
    }

    // Spent from the one daily budget every model call comes out of, and spent
    // before the provider is reached rather than after, so a call that reached
    // it counts whether or not it came back with anything. Everything refused
    // above this line costs nothing at all.
    if ((await spendModelCall(user.id)) === "over-limit") {
      return errorResponse(
        "You have used today's allowance of model calls. Try again tomorrow.",
        MODEL_CALL_LIMIT_STATUS,
      );
    }

    let outcome: AnalysisOutcome;
    try {
      outcome = await analyse({
        cvText: cvText.slice(0, MAX_CV_TEXT_LENGTH),
        requirements: requirements.map(({ skill, necessity }) => ({
          skill,
          necessity,
        })),
      });
    } catch {
      // Every way of failing to reach or understand the provider — an outage,
      // an exhausted quota, a malformed reply, a reply with no usable rating —
      // is one answer, and a different one from a spent allowance: this one
      // says try again shortly and that one says try tomorrow. Nothing has
      // been written, so whatever the last Analysis said is still there.
      return providerUnreachable();
    }

    const verdicts = addressed(outcome.readings, jobApplication);

    // A reply that landed on no Requirement is a provider that could not be
    // understood, not an Analysis of nothing: stamping a run that read nothing
    // would leave the Job Application reading as freshly analysed.
    if (verdicts.length === 0) return providerUnreachable();

    await recordAnalysis(user.id, id, verdicts, {
      rating: outcome.rating,
      feedback: outcome.feedback,
    });

    // Read back rather than assembled from what was just written, so that what
    // a run answers with and what a later read answers with come from one
    // place and cannot drift apart.
    const analysis = await readAnalysis(user.id, jobApplication);
    if (analysis === null) {
      throw new Error("The Analysis that just ran could not be read back.");
    }

    const result: AnalysisResult = {
      analysis,
      requirements: await requirementsFor(user.id, id),
    };

    return Response.json(result);
  };
}

/**
 * `GET /api/job-applications/:id/analysis`. When the last Analysis ran and
 * whether it still stands, or `null` where none has — an ordinary state rather
 * than a 404, so a client is not made to read "never analysed" as a failure.
 *
 * The verdicts are not here: each belongs to the Requirement it is about and
 * arrives with the Job Application. What this address answers is the part that
 * belongs to the run.
 *
 * A plain function rather than a factory, unlike the run above: there is
 * nothing here for a test to substitute, because reading an Analysis reaches
 * no provider.
 */
export async function readAnalysisResponse(
  _request: Request,
  user: CurrentUser,
  { id }: AnalysisParams,
): Promise<Response> {
  if (!isJobApplicationId(id)) return notFound();

  const jobApplication = await getJobApplication(user.id, id);
  if (jobApplication === null) return notFound();

  return Response.json(await readAnalysis(user.id, jobApplication));
}

/**
 * The model's verdicts against the rows they are about. The provider answers
 * by position, because that is what its flat schema can express; this is where
 * a position becomes a Requirement's own id, and where a verdict about a
 * Requirement nobody asked about is dropped rather than written somewhere.
 */
function addressed(
  readings: readonly AnalysedReading[],
  jobApplication: JobApplication,
): AnalysedRequirement[] {
  return readings.flatMap(({ index, coverage, reason }) => {
    const requirement = jobApplication.requirements[index];

    return requirement === undefined
      ? []
      : [{ requirementId: requirement.id, coverage, reason }];
  });
}

/**
 * What a user is told when the model could not be reached or understood. A
 * different sentence from a spent allowance, because the two ask for different
 * things of them — and neither has written anything, so a previous Analysis is
 * still whatever it was.
 */
function providerUnreachable(): Response {
  return errorResponse(
    "The service that runs an Analysis could not be reached. Try again shortly.",
    502,
  );
}

/**
 * Somebody else's Job Application and one that does not exist are the same
 * answer, so that the API never confirms a stranger's row is real.
 */
function notFound(): Response {
  return errorResponse("No such Job Application.", 404);
}
