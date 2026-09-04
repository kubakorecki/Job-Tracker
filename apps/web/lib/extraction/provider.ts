import { GoogleGenAI } from "@google/genai";
import {
  ExtractJobRequest,
  JobExtraction,
  RemoteType,
  type Requirement,
} from "@repo/schema";
import { z } from "zod";
import { geminiApiKey } from "../env";

/**
 * The one place this app talks to an LLM. Everything above it — the endpoint,
 * the rate limit, the response union — is written against `ExtractJob` and has
 * never heard of Gemini, which is what makes this both the swap point for a
 * second provider and the substitution point for the endpoint's tests.
 */

/**
 * The model extraction runs on. One constant, named once: the documented
 * identifier moves, and a string spread across a prompt builder, a config and
 * a log would move unevenly.
 *
 * Confirmed against ai.google.dev/gemini-api/docs/models on 2026-09-03, which
 * lists this as the current stable Pro model. The other Pro identifier there,
 * `gemini-3.1-pro-preview`, is deliberately not used: a preview carries
 * tighter rate limits and a two-week deprecation notice, and this is the only
 * model in the product — there is nothing to fall back to when it is
 * withdrawn.
 */
export const EXTRACTION_MODEL = "gemini-2.5-pro";

/**
 * Reads a Posting and answers with what it says. It takes the endpoint's own
 * request shape, already truncated — deciding how much of a page a model is
 * worth showing is the endpoint's business, not a provider's.
 *
 * A Draft with nothing in it is a real answer: the page was not a Posting. So
 * this rejects only when the provider could not be asked or could not be
 * understood, and the endpoint turns any rejection into `provider_error`.
 * Distinguishing an outage from a malformed reply would gain the caller
 * nothing: both mean fall back to manual entry.
 */
export type ExtractJob = (request: ExtractJobRequest) => Promise<JobExtraction>;

/**
 * What the model is asked to fill in. It is deliberately flat — nine
 * primitives and one array of strings, no nested objects and no `anyOf` —
 * because Gemini accepts only a subset of JSON Schema and a schema it cannot
 * process is rejected outright rather than partially honoured.
 *
 * Flatness is why a field the page does not state comes back empty rather than
 * null: every property is required, and "the page does not say" is expressed
 * in the value. `readDraft` below is the other half, turning those empties
 * back into a Draft that simply omits the field.
 */
type FlatProperty = {
  type: "string" | "number" | "array";
  description: string;
  enum?: string[];
  items?: { type: "string" };
};

/**
 * Keyed by the Draft's own fields, so a field added to `JobExtraction` in the
 * shared contract is a type error here rather than a column the model is never
 * asked about.
 */
const DRAFT_PROPERTIES = {
  company: {
    type: "string",
    description:
      "The employer's name. Empty if the page does not name one, or names only a recruitment agency posting on an unnamed client's behalf.",
  },
  jobTitle: {
    type: "string",
    description:
      "The title of this one role, as the posting words it. Empty if the page is not a job posting.",
  },
  location: {
    type: "string",
    description:
      "Where the role is based, as the posting words it. Empty if the page does not say.",
  },
  remoteType: {
    type: "string",
    enum: [...RemoteType.options, ""],
    description:
      "How the role is worked, if the posting states it. Empty if it does not.",
  },
  salaryMin: {
    type: "number",
    description:
      "The bottom of the stated annual salary range, as a plain number. A single stated figure goes in both bounds. 0 if the page states no salary.",
  },
  salaryMax: {
    type: "number",
    description:
      "The top of the stated annual salary range, as a plain number. 0 if the page states no salary.",
  },
  currency: {
    type: "string",
    description:
      "The ISO 4217 code of the stated salary, such as GBP or USD. Empty if no salary is stated.",
  },
  description: {
    type: "string",
    description:
      "The posting's own summary of the role, in at most a short paragraph. Empty if the page does not describe one.",
  },
  requirements: {
    type: "array",
    items: { type: "string" },
    description:
      "The skills, technologies and qualifications the posting asks for, at most twelve, each worded as the page words it. Empty if the page lists none.",
  },
} satisfies Record<keyof JobExtraction, FlatProperty>;

const DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  properties: DRAFT_PROPERTIES,
  required: Object.keys(DRAFT_PROPERTIES),
};

/**
 * What comes back. Every field falls back rather than failing, because one
 * field the model worded oddly should not cost the user the other eight — and
 * a reply that is not an object at all still fails here, which is the case
 * that genuinely means the provider could not be understood.
 */
const ProviderDraft = z.object({
  company: z.string().catch(""),
  jobTitle: z.string().catch(""),
  location: z.string().catch(""),
  remoteType: RemoteType.or(z.literal("")).catch(""),
  salaryMin: z.number().nonnegative().catch(0),
  salaryMax: z.number().nonnegative().catch(0),
  currency: z.string().catch(""),
  description: z.string().catch(""),
  requirements: z.array(z.string()).catch([]),
});

const INSTRUCTIONS = `You read the visible text of a web page and record what it says about one job, for a job application tracker.

Record only what the page states. Do not guess, do not infer from what you know of the employer, and do not borrow a value from a different role listed elsewhere on the same page. Where a page advertises several roles, record the one the URL addresses.

Leave a field empty when the page does not state it: an empty string for text, 0 for a salary, an empty array for requirements. A page that is not a job posting is a normal outcome — leave the company and the job title both empty and say nothing else about it. Never invent a company or a title to avoid returning an empty answer.

Salaries are annual figures in the currency the page names, written as plain numbers with no separators or symbols. Convert an hourly, daily or monthly rate only when the page itself gives the annual equivalent; otherwise leave the salary empty.`;

/**
 * The Gemini implementation. Everything that can go wrong here — no key, no
 * network, an exhausted quota, a reply that is not the JSON it promised —
 * leaves as a rejection, because they all mean the same thing to the user.
 * There is deliberately no retry on a cheaper model: a visible failure is how
 * the user learns the grant is spent.
 */
export const extractWithGemini: ExtractJob = async ({ url, pageText }) => {
  const response = await gemini().models.generateContent({
    model: EXTRACTION_MODEL,
    contents: `URL: ${url}\n\nPage text:\n${pageText}`,
    config: {
      systemInstruction: INSTRUCTIONS,
      responseMimeType: "application/json",
      responseJsonSchema: DRAFT_RESPONSE_SCHEMA,
    },
  });

  const { text } = response;
  if (text === undefined || text === "") {
    throw new Error(`${EXTRACTION_MODEL} answered with no content.`);
  }

  return readDraft(text);
};

/**
 * The model's JSON as a Draft, with everything it left empty left out. An
 * empty string is the flat schema's way of saying "the page does not say", and
 * a Draft says the same thing by not carrying the field at all — so nothing
 * above this function has to know which of the two it is reading.
 */
export function readDraft(json: string): JobExtraction {
  const raw = ProviderDraft.parse(JSON.parse(json));

  return {
    company: nonEmpty(raw.company),
    jobTitle: nonEmpty(raw.jobTitle),
    location: nonEmpty(raw.location),
    remoteType: raw.remoteType === "" ? undefined : raw.remoteType,
    salaryMin: raw.salaryMin === 0 ? undefined : raw.salaryMin,
    salaryMax: raw.salaryMax === 0 ? undefined : raw.salaryMax,
    currency: nonEmpty(raw.currency),
    description: nonEmpty(raw.description),
    requirements: nonEmptyRequirements(raw.requirements),
  };
}

/**
 * The skills the model listed, as Requirements, and undefined when it listed
 * none it could name — the same "the page does not say" that `nonEmpty` gives
 * every text field, decided after the blanks are dropped rather than before,
 * so a list of nothing but empty strings is absent rather than empty.
 *
 * Every Requirement is `unstated`: this schema asks for one flat list and so
 * records only that the Posting named something, never how badly it wanted it
 * — which is exactly what `unstated` means. Reading the Necessity is a change
 * to the schema and the prompt, not to this fold.
 */
function nonEmptyRequirements(skills: string[]): Requirement[] | undefined {
  const named = skills
    .map((skill) => skill.trim())
    .filter((skill) => skill !== "")
    .map((skill) => ({ skill, necessity: "unstated" as const }));

  return named.length === 0 ? undefined : named;
}

/** One text field, trimmed, and undefined when it was only ever whitespace. */
function nonEmpty(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
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
