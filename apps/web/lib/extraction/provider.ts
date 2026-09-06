import { GoogleGenAI } from "@google/genai";
import {
  ExtractJobRequest,
  JobExtraction,
  Necessity,
  RemoteType,
  type Requirement,
  SalaryPeriod,
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
 * primitives and three arrays of strings, no nested objects and no `anyOf` —
 * because Gemini accepts only a subset of JSON Schema and a schema it cannot
 * process is rejected outright rather than partially honoured.
 *
 * Flatness is why a field the page does not state comes back empty rather than
 * null: every property is required, and "the page does not say" is expressed
 * in the value. It is also why a Requirement's Necessity is carried by which
 * array the skill came in rather than beside it: a list of tagged objects is
 * exactly the nested shape this schema cannot ask for. `readDraft` below is
 * the other half, turning those empties back into a Draft that simply omits
 * the field, and those three arrays back into one tagged list.
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
 * asked about. Requirements are the one field not asked for under its own
 * name; `REQUIREMENT_PROPERTIES` below asks for them instead.
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
      "The bottom of the stated salary range, as a plain number, over the period given by salaryPeriod. A single stated figure goes in both bounds. Where the posting states several ranges, the lowest of their bottoms. 0 if the page states no salary.",
  },
  salaryMax: {
    type: "number",
    description:
      "The top of the stated salary range, as a plain number, over the period given by salaryPeriod. Where the posting states several ranges, the highest of their tops. 0 if the page states no salary.",
  },
  salaryPeriod: {
    type: "string",
    enum: [...SalaryPeriod.options, ""],
    description:
      "The period the two salary figures are a rate over, as the posting states it. Empty if no salary is stated.",
  },
  currency: {
    type: "string",
    description:
      "The ISO 4217 code of the stated salary, such as GBP, USD or PLN. Empty if no salary is stated.",
  },
  description: {
    type: "string",
    description:
      "The posting's own summary of the role, in at most a short paragraph. Empty if the page does not describe one.",
  },
} satisfies Record<Exclude<keyof JobExtraction, "requirements">, FlatProperty>;

/**
 * The Requirements, as one array of bare skills per Necessity. Keyed by the
 * Necessity itself, so a value added to that closed set is a type error here
 * rather than a Necessity the model is never given anywhere to put.
 *
 * The names carry the `Skills` suffix because a property called `required`
 * sitting inside a JSON Schema's `properties` reads as the schema keyword of
 * the same name, to a reader and plausibly to the model.
 */
const REQUIREMENT_PROPERTIES = {
  requiredSkills: {
    type: "array",
    items: { type: "string" },
    description:
      "What the posting states a candidate must have. Empty if it insists on nothing.",
  },
  preferredSkills: {
    type: "array",
    items: { type: "string" },
    description:
      "What the posting calls desirable, a bonus, a plus or nice to have. Empty if it names none.",
  },
  unstatedSkills: {
    type: "array",
    items: { type: "string" },
    description:
      "What the posting names without saying whether it is essential or merely desirable. Empty if it names none.",
  },
} satisfies Record<`${Necessity}Skills`, FlatProperty>;

const RESPONSE_PROPERTIES = { ...DRAFT_PROPERTIES, ...REQUIREMENT_PROPERTIES };

const DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  properties: RESPONSE_PROPERTIES,
  required: Object.keys(RESPONSE_PROPERTIES),
};

/**
 * What comes back. Every field falls back rather than failing, because one
 * field the model worded oddly should not cost the user the rest — and
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
  salaryPeriod: SalaryPeriod.or(z.literal("")).catch(""),
  currency: z.string().catch(""),
  description: z.string().catch(""),
  requiredSkills: skillList(),
  preferredSkills: skillList(),
  unstatedSkills: skillList(),
});

/**
 * The shape one Necessity's list comes back in, falling back like every other
 * field: a list the model worded as something other than an array of strings
 * costs the Posting that Necessity, not the other two.
 */
function skillList() {
  return z.array(z.string()).catch([]);
}

const INSTRUCTIONS = `You read the visible text of a web page and record what it says about one job, for a job application tracker.

Record only what the page states. Do not guess, do not infer from what you know of the employer, and do not borrow a value from a different role listed elsewhere on the same page. Where a page advertises several roles, record the one the URL addresses.

Leave a field empty when the page does not state it: an empty string for text, 0 for a salary, an empty array for each of the three skill lists. A page that is not a job posting is a normal outcome — leave the company and the job title both empty and say nothing else about it. Never invent a company or a title to avoid returning an empty answer.

Record what the posting asks of a candidate as separate skills, each worded as the page words it: technologies, practices, qualifications, languages, and quantities of experience such as "5+ years of backend". Put each one in the list that matches how badly the posting says it wants it — requiredSkills for what it states a candidate must have, preferredSkills for what it calls desirable, a bonus, a plus or nice to have, and unstatedSkills for anything it names without saying which. A skill listed without a stated preference is unstated: never move one up into requiredSkills because it sounds important or is mentioned first. At most twelve skills across the three lists together, and all three empty if the posting asks for nothing.

Record a salary as the page states it, never converted to another period: plain numbers with no separators or symbols, the period the page quotes over in salaryPeriod, and the currency as an ISO 4217 code — a page writing "z\u0142" or "PLN" means PLN, "\u00a3" means GBP. A monthly rate stays monthly and an hourly rate stays hourly; do not annualise, and do not read an annual equivalent the page does not print.

Where the posting states several salaries for one role — an employment contract beside a B2B rate, gross beside net — take the widest span they cover together: salaryMin from the lowest figure stated and salaryMax from the highest, provided they are quoted over the same period. Where the periods differ, record the range for the contract of employment and ignore the rest.`;

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
    salaryPeriod: raw.salaryPeriod === "" ? undefined : raw.salaryPeriod,
    currency: nonEmpty(raw.currency),
    description: nonEmpty(raw.description),
    requirements: requirementsOf(raw),
  };
}

/**
 * The model's three lists as one tagged Requirement list, each skill carrying
 * the Necessity of the list it arrived in, and undefined when it named none it
 * could word — the same "the page does not say" that `nonEmpty` gives every
 * text field, decided after the blanks are dropped rather than before, so
 * lists of nothing but empty strings are absent rather than empty. A Posting
 * that asks for nothing is a normal reading; the Job Application made from
 * such a Draft simply has no Requirements.
 *
 * Read in `Necessity` order, so the hard Requirements lead the list wherever
 * it is shown before anything groups it.
 */
function requirementsOf(
  raw: z.infer<typeof ProviderDraft>,
): Requirement[] | undefined {
  const named = Necessity.options.flatMap((necessity) =>
    raw[`${necessity}Skills`]
      .map((skill) => skill.trim())
      .filter((skill) => skill !== "")
      .map((skill) => ({ skill, necessity })),
  );

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
