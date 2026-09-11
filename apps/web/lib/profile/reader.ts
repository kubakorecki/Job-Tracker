import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  tokensReported,
  UnreadableAnswer,
  type Metered,
} from "../ai-usage/metered";
import { geminiApiKey } from "../env";
import type { CvMediaType } from "./contract";

/**
 * Reading an uploaded CV: the document's text, and the skills it states.
 * Like the extraction provider, this is the one place the app talks to a model
 * about a CV, and everything above it — the endpoint, the budget, the
 * response — is written against `ReadCv` and has never heard of Gemini.
 *
 * It shares nothing with job extraction but that boundary: its own model, its
 * own instructions, its own response schema, its own reply. The two read
 * different documents for different reasons and are not to be refactored
 * together — a prompt that tried to serve both would serve neither, and a
 * property map shared between them would make every change to one a change to
 * the other.
 */

/**
 * The model a CV is read by. Its own constant rather than extraction's,
 * because reading a document and reading a web page are different jobs that
 * may want different models, and a shared name is how they would stop being
 * able to differ.
 *
 * Confirmed against ai.google.dev/gemini-api/docs/models on 2026-09-03 as the
 * current stable Pro model, and it is the Pro models that read PDFs natively —
 * which is the whole reason no parsing library is added here.
 */
export const CV_READING_MODEL = "gemini-2.5-pro";

/**
 * How many skills the model is asked for. Well under what a Profile may hold
 * (`SKILL_LIST_LIMIT`), because a proposal is something a person has to read
 * through and correct: a list of eighty is not reviewed, it is accepted
 * blindly, which is the one thing this Draft exists to prevent.
 */
export const PROPOSED_SKILL_LIMIT = 30;

/** One uploaded CV, as it arrives: the bytes, and what they were accepted as. */
export type CvFile = { bytes: Uint8Array; mediaType: CvMediaType };

/**
 * What one reading of a CV comes back with: the document's text, for an
 * Analysis to read, and the skills proposed from it — a Draft, which nothing
 * has yet accepted.
 *
 * They arrive together because they are one question asked of one document,
 * and one model call: asking twice would spend two of the user's daily
 * allowance to read a document that only has to be read once.
 */
export type CvReading = { text: string; skills: string[] };

/**
 * Reads a CV.
 *
 * An empty text is a real answer: the file held no text this could reach — a
 * scan, a mangled export, a PDF of nothing — and the endpoint turns it into
 * the message asking for a cleaner copy. An empty skill list is a real answer
 * too: a document whose skills the model could not name is still a CV, and the
 * user can type their own. So this rejects only when a provider could not be
 * asked or could not be understood, which is a different failure and gets a
 * different answer.
 */
export type ReadCv = (file: CvFile) => Promise<Metered<CvReading>>;

/**
 * Whether the document's text will come from the model. From a PDF it will: it
 * is a container the model reads natively, which is what keeps a parsing
 * library out of this app. From a Markdown or plain text file it will not — the
 * file already is its text, and a model asked to hand a document back verbatim
 * is a way to lose some of it, not a way to read it.
 *
 * The model is asked about both either way. Only the transcription is a
 * question a text file has already answered; the skills are not.
 */
export function textComesFromTheModel(mediaType: CvMediaType): boolean {
  return mediaType === "application/pdf";
}

/**
 * What the model is asked to fill in. Flat, and for the same reason the
 * extraction schema is: Gemini accepts only a subset of JSON Schema and
 * rejects a shape it cannot process outright rather than partially honouring
 * it. Nothing here is shared with that schema — a CV and a job posting have no
 * field in common — only the constraint they are both written under.
 */
const TEXT_PROPERTY = {
  type: "string",
  description:
    "The document's own words, in the order it uses them, every bullet on its own line. Empty if the document holds no text you can read.",
};

const SKILLS_PROPERTY = {
  type: "array",
  items: { type: "string" },
  description: `The skills the CV states its subject has, at most ${PROPOSED_SKILL_LIMIT} of them. Empty if the document names none.`,
};

const TRANSCRIPT_SCHEMA = {
  type: "object",
  properties: { text: TEXT_PROPERTY, skills: SKILLS_PROPERTY },
  required: ["text", "skills"],
};

const SKILLS_SCHEMA = {
  type: "object",
  properties: { skills: SKILLS_PROPERTY },
  required: ["skills"],
};

/**
 * A skill list, as it comes back. It falls back rather than failing, because a
 * list the model worded oddly should not cost the user the transcription as
 * well: an empty proposal is a reading the user can correct, and a failed
 * upload is not.
 */
const ProviderSkills = z.array(z.string()).catch([]);

/**
 * What comes back from a transcription. The text does not fall back: it is the
 * whole reason that call was made, and a reply without it is a provider that
 * could not be understood — which has to reject, because the endpoint reads an
 * empty text as "this document holds none" and tells the user to export a
 * cleaner copy. Their file would not have been the problem.
 */
const TranscriptReply = z.object({
  text: z.string(),
  skills: ProviderSkills,
});

/** What comes back when the text was never in question. */
const SkillsReply = z.object({ skills: ProviderSkills });

/**
 * What every reading asks for, transcription or not. Kept as one paragraph
 * used by both instructions, because the skills half of the question does not
 * change with the format the document arrived in.
 */
const SKILLS_INSTRUCTION = `List the skills the CV states its subject has: technologies, tools, practices, qualifications, languages, and anything else the document offers as something they can do. Word each one as the document words it, one skill per entry, and never more than ${PROPOSED_SKILL_LIMIT} — the shortest list that still covers the document is the best one.

Record only what the document states. Do not infer a skill from an employer, a job title or a degree, do not add what a person in this role usually knows, and do not split one skill into its parts. Leave the list empty rather than filling it with guesses: the user reviews this list and adds what is missing, so a skill you left out costs them a moment and a skill you invented costs them their trust in it.`;

const TRANSCRIPT_INSTRUCTIONS = `You read a CV, so that it can be stored as text and its skills reviewed.

Return the document's own words as the text and nothing else. Do not summarise, do not rewrite, do not translate, and do not add headings, commentary or apologies of your own. Keep the order the document uses, keep each entry's dates and employer alongside it, and put every bullet on its own line.

Where the document is laid out in columns, read each column through rather than across, so that a line from one never lands in the middle of the other.

Return an empty text if the document holds no text you can read — a scan with no text layer, or an empty file. An empty answer is the correct answer there, and the skill list is then empty too.

${SKILLS_INSTRUCTION}`;

const SKILLS_INSTRUCTIONS = `You read the text of a CV and record the skills it states.

${SKILLS_INSTRUCTION}`;

/**
 * The Gemini implementation. Everything that can go wrong reaching it — no
 * key, no network, an exhausted quota, an empty reply object — leaves as a
 * rejection, because they all mean the same thing to the user: the reading did
 * not happen and it is not their file's fault.
 */
export const readCvWithGemini: ReadCv = async ({ bytes, mediaType }) => {
  if (textComesFromTheModel(mediaType)) {
    return askGemini({
      instructions: TRANSCRIPT_INSTRUCTIONS,
      schema: TRANSCRIPT_SCHEMA,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mediaType,
                data: Buffer.from(bytes).toString("base64"),
              },
            },
          ],
        },
      ],
      read: (json) => {
        const reply = TranscriptReply.parse(json);
        return { text: reply.text.trim(), skills: reply.skills };
      },
    });
  }

  const text = decodedText(bytes);

  // Nothing to propose skills from, and nothing the user can be told about
  // this file but to upload a cleaner one. Asking anyway would spend a call on
  // an empty document — and an unasked call costs nothing, which is what the
  // nought here says.
  if (text === "") return { answer: { text, skills: [] }, tokens: 0 };

  const asked = await askGemini({
    instructions: SKILLS_INSTRUCTIONS,
    schema: SKILLS_SCHEMA,
    contents: text,
    read: (json) => SkillsReply.parse(json).skills,
  });

  // The text is the file's own, not the model's: it was never asked for it.
  return { answer: { text, skills: asked.answer }, tokens: asked.tokens };
};

/** What the SDK will take as the body of one request. */
type GeminiContents = Parameters<
  GoogleGenAI["models"]["generateContent"]
>[0]["contents"];

/**
 * One question, what the reply amounted to, and what it cost. Every way of
 * failing to reach or understand the provider leaves here as a rejection.
 *
 * `read` is the caller's, because what a reply has to carry differs with what
 * was asked — and it runs in here rather than outside so that a reply which
 * cannot be read still reports its tokens. The provider answered and billed
 * for it; only a call that fails before it answers is free (ADR-0009).
 */
async function askGemini<Answer>({
  instructions,
  schema,
  contents,
  read,
}: {
  instructions: string;
  schema: object;
  contents: GeminiContents;
  read: (json: unknown) => Answer;
}): Promise<Metered<Answer>> {
  const response = await gemini().models.generateContent({
    model: CV_READING_MODEL,
    contents,
    config: {
      systemInstruction: instructions,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    },
  });

  const tokens = tokensReported(response.usageMetadata);

  const { text } = response;
  if (text === undefined || text === "") {
    throw new UnreadableAnswer(
      tokens,
      `${CV_READING_MODEL} answered with no content.`,
    );
  }

  try {
    return { answer: read(JSON.parse(text)), tokens };
  } catch (cause) {
    throw new UnreadableAnswer(
      tokens,
      `${CV_READING_MODEL} answered with something that could not be read: ${String(cause)}`,
    );
  }
}

/**
 * A text file's own text. `fatal` because bytes that are not UTF-8 are not a
 * document we can read — they come back as the empty answer that asks the user
 * for a cleaner copy, rather than as a page of replacement characters stored
 * for an Analysis to puzzle over.
 */
export function decodedText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  } catch {
    return "";
  }
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
