import { GoogleGenAI } from "@google/genai";
import { Coverage, type Requirement } from "@repo/schema";
import { z } from "zod";
import {
  tokensReported,
  UnreadableAnswer,
  type Metered,
} from "../ai-usage/metered";
import { geminiApiKey } from "../env";

/**
 * The one place this app asks a model how a CV answers a Posting's
 * Requirements. Everything above it — the endpoint, the budget, the stored
 * verdicts — is written against `AnalyseCoverage` and has never heard of
 * Gemini, which is what makes this both the swap point for a second provider
 * and the substitution point for the endpoint's tests.
 *
 * It shares nothing with job extraction or CV reading but that boundary: its
 * own model, its own instructions, its own response schema, its own reply.
 * The three read different things for different reasons and are not to be
 * refactored together — a prompt serving all of them would serve none.
 */

/**
 * The model an Analysis runs on. Its own constant rather than extraction's or
 * the CV reader's, because judging evidence and transcribing a document are
 * different jobs that may want different models, and a shared name is how they
 * would stop being able to differ.
 *
 * Confirmed against ai.google.dev/gemini-api/docs/models on 2026-09-03 as the
 * current stable Pro model. The reasoning this asks for — four years of React
 * against a Posting's five — is the whole reason the Analysis exists, so this
 * is the one call in the product with no cheaper alternative worth taking.
 */
export const ANALYSIS_MODEL = "gemini-2.5-pro";

/**
 * What one run is asked about: the Profile's prose, and the Requirements in
 * the order they are to be answered in.
 *
 * The CV's text rather than its accepted skill list, because the list is what
 * the normalised comparison already read and answering from it again would
 * spend a model call to repeat a string match. The prose is where "four years
 * of React" lives, and it is the whole reason this is worth asking.
 *
 * The Requirements arrive without their ids: which row a verdict lands on is
 * the endpoint's business, and a provider that never sees an id cannot be
 * talked into naming one.
 */
export type AnalysisRequest = {
  cvText: string;
  requirements: readonly Requirement[];
};

/**
 * One verdict, about the Requirement at `index` in the list that was asked
 * about. Position is how a verdict finds its Requirement, because that is what
 * the flat response schema below can express — see `ANALYSIS_PROPERTIES`.
 */
export type AnalysedReading = {
  index: number;
  coverage: Coverage;
  reason: string;
};

/** A rating out of ten of how likely a CV is to earn an interview. */
export const Rating = z.number().int().min(1).max(10);
export type Rating = z.infer<typeof Rating>;

/**
 * How many characters of the improvement feedback are worth keeping. It is a
 * paragraph under the rating, not a rewrite of the CV.
 */
export const MAX_FEEDBACK_LENGTH = 600;

/**
 * What one run answers with: a verdict for every Requirement it could form an
 * opinion about, and its one overall read of the CV against the Posting —
 * an HR reader's rating of the candidate's chance of an interview, and what
 * would raise it.
 *
 * `rating` and `feedback` are `null` where the reply carried the readings but
 * nothing usable for the overall opinion — the same "this source has not
 * spoken" reading the three Coverage columns give a Requirement it could not
 * answer about. Discarding good readings over one bad field would waste a
 * reply that mostly worked; only a reply with no readings at all rejects the
 * run outright, which the endpoint turns into its own distinct answer.
 */
export type AnalysisOutcome = {
  readings: AnalysedReading[];
  rating: Rating | null;
  feedback: string | null;
};

/**
 * Reads the Requirements against the CV and answers with a verdict for each,
 * plus the run's own rating and improvement feedback.
 *
 * Fewer verdicts than Requirements is a real answer: a Requirement the model
 * could not word an opinion about is left unread rather than guessed at, and
 * whatever an earlier run said about it stands. This rejects only when the
 * provider could not be asked or could not be understood about any
 * Requirement at all — never for a bad rating or feedback alone, which come
 * back `null` instead.
 */
export type AnalyseCoverage = (
  request: AnalysisRequest,
) => Promise<Metered<AnalysisOutcome>>;

/**
 * How many characters of a Requirement's reason are worth keeping. It is a
 * line beside a badge; a paragraph would be a different affordance, and one
 * the model is asked not to write.
 */
export const MAX_REASON_LENGTH = 200;

/**
 * What the model is asked to fill in: two arrays running in step, a verdict
 * and its line, in the order the Requirements were given.
 *
 * Flat, and for the reason the extraction and CV schemas are — Gemini accepts
 * only a subset of JSON Schema and rejects a shape it cannot process outright.
 * A list of `{ skill, coverage, reason }` objects is precisely the nested
 * shape that cannot be asked for, so the pairing is carried by position, the
 * way extraction carries a Necessity by which array a skill arrived in.
 * `readOutcome` below is the other half, zipping the two back into verdicts.
 */
const ANALYSIS_PROPERTIES = {
  coverages: {
    type: "array",
    items: { type: "string", enum: [...Coverage.options] },
    description:
      "One verdict per numbered requirement, in the same order they were listed, and exactly as many entries as there were requirements.",
  },
  reasons: {
    type: "array",
    items: { type: "string" },
    description: `One sentence per numbered requirement, in the same order, saying what in the CV led to the verdict beside it. At most ${MAX_REASON_LENGTH} characters each.`,
  },
  rating: {
    type: "integer",
    description:
      "An HR expert's rating, from 1 to 10, of how likely this CV is to earn the candidate an interview for this posting.",
  },
  feedback: {
    type: "string",
    description: `The HR expert's opinion on what the candidate could do to improve that rating — concrete and specific to what the CV is missing or underselling. At most ${MAX_FEEDBACK_LENGTH} characters.`,
  },
};

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: ANALYSIS_PROPERTIES,
  required: Object.keys(ANALYSIS_PROPERTIES),
};

/**
 * What comes back. Each array falls back rather than failing, so that a reply
 * the model worded oddly is caught by the zip below as "it answered about
 * nothing" — one rejection for every way of not being understood — rather than
 * as a parse error in one place and an empty answer in another.
 */
const ProviderReply = z.object({
  coverages: z.array(z.string()).catch([]),
  reasons: z.array(z.string()).catch([]),
  rating: z.unknown().optional(),
  feedback: z.string().catch(""),
});

const INSTRUCTIONS = `You are an HR expert judging how well one CV answers what a job posting asks for, for a job application tracker.

You are given the text of a CV and a numbered list of requirements. Answer every one of them, in order, with a verdict and one sentence of your reasoning:

- have — the CV shows this. The wording need not match: "Node.js" answers "backend JavaScript", and eight years of Python answers "5+ years of Python".
- partial — the CV shows some of it but not what was asked. Four years against a stated five, a related tool rather than the named one, or the skill present but incidental to the work described.
- missing — the CV does not show this.

Judge only from the CV's own words. Do not assume a skill from a job title, an employer or a degree, and do not credit something the document never mentions. Where a requirement states a quantity of experience, work it out from the dates the CV gives rather than from how senior the person sounds.

Each reason is one sentence, at most ${MAX_REASON_LENGTH} characters, naming what in the CV decided it — "Four years of React across two roles, against the five asked for", not "Partially covered". Write it to the person whose CV it is: it is what they will read to know what to change.

Return exactly as many verdicts as there were requirements, and exactly as many reasons, in the order they were listed. Never reorder them, never merge two requirements into one answer, and never add an entry for a requirement that was not listed.

Then, having read the whole CV against the whole posting, give your overall opinion as the hiring manager screening this application:

- rating — an integer from 1 to 10 for how likely this CV is to earn the candidate an interview for this posting. 1 is no realistic chance; 10 is a near-certain interview. Weigh the required requirements far more heavily than the preferred ones.
- feedback — at most ${MAX_FEEDBACK_LENGTH} characters of concrete advice on what the candidate could change to raise that rating: what to add, quantify, reword or move higher up the CV. Write it to the candidate, not about them, and ground every point in a specific requirement above rather than generic advice.`;

/**
 * The Gemini implementation. Everything that can go wrong here — no key, no
 * network, an exhausted quota, a reply that is not the JSON it promised —
 * leaves as a rejection, because they all mean the same thing to the user: the
 * Analysis did not happen and their Job Application is unchanged.
 */
export const analyseWithGemini: AnalyseCoverage = async ({
  cvText,
  requirements,
}) => {
  const response = await gemini().models.generateContent({
    model: ANALYSIS_MODEL,
    contents: `CV:\n${cvText}\n\nRequirements:\n${asked(requirements)}`,
    config: {
      systemInstruction: INSTRUCTIONS,
      responseMimeType: "application/json",
      responseJsonSchema: ANALYSIS_SCHEMA,
    },
  });

  // What this run cost, read before the reply is, because a reply that cannot
  // be read was still charged for — and an Analysis is the most expensive call
  // the product makes on its own, so those are the tokens least worth losing
  // (ADR-0009).
  const tokens = tokensReported(response.usageMetadata);

  const { text } = response;
  if (text === undefined || text === "") {
    throw new UnreadableAnswer(
      tokens,
      `${ANALYSIS_MODEL} answered with no content.`,
    );
  }

  try {
    return { answer: readOutcome(text, requirements.length), tokens };
  } catch (cause) {
    throw new UnreadableAnswer(
      tokens,
      `${ANALYSIS_MODEL} answered with something that is not an Analysis: ${String(cause)}`,
    );
  }
};

/**
 * The Requirements as the model is shown them: numbered, so that "in the order
 * they were listed" is something it can check itself against, and carrying the
 * Necessity, because how badly a Posting wants something is part of reading
 * whether a CV answers it.
 */
function asked(requirements: readonly Requirement[]): string {
  return requirements
    .map(
      ({ skill, necessity }, index) => `${index + 1}. ${skill} (${necessity})`,
    )
    .join("\n");
}

/**
 * The whole of a run: the per-Requirement verdicts, paired by position and
 * dropping anything that is not one, plus the rating and feedback the same
 * reply carries.
 *
 * A verdict survives only if its Coverage is one of the three and the reason
 * says something: a Requirement the model answered with a word we do not
 * have, or with a verdict and no reasoning, is left unread rather than
 * recorded with half an answer. `asked` bounds the pairing, so a reply longer
 * than the list cannot invent a verdict about a Requirement nobody named.
 *
 * The rating and feedback are read the same way — `null` where the reply did
 * not carry a usable one, rather than discarding the readings alongside them.
 * Only a reply that answered about no Requirement at all rejects the run,
 * because that is a provider which could not be understood rather than a
 * reading — and the endpoint has a different thing to say about each.
 */
export function readOutcome(json: string, count: number): AnalysisOutcome {
  const raw = ProviderReply.parse(JSON.parse(json));

  const readings: AnalysedReading[] = [];
  for (let index = 0; index < count; index++) {
    const coverage = Coverage.safeParse(raw.coverages[index]);
    const reason = raw.reasons[index]?.trim() ?? "";

    if (coverage.success && reason !== "") {
      readings.push({
        index,
        coverage: coverage.data,
        reason: reason.slice(0, MAX_REASON_LENGTH),
      });
    }
  }

  if (readings.length === 0) {
    throw new Error(`${ANALYSIS_MODEL} answered about no Requirement.`);
  }

  const rating = Rating.safeParse(raw.rating);
  const feedback = raw.feedback.trim();

  return {
    readings,
    rating: rating.success ? rating.data : null,
    feedback: feedback === "" ? null : feedback.slice(0, MAX_FEEDBACK_LENGTH),
  };
}

let client: GoogleGenAI | null = null;

/**
 * Built on first use rather than at module load, so importing the endpoint —
 * which every test of it does — costs no API key.
 */
function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: geminiApiKey() });
  return client;
}
