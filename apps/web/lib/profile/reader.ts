import { GoogleGenAI } from "@google/genai";
import { geminiApiKey } from "../env";
import type { CvMediaType } from "./contract";

/**
 * Reading the text out of an uploaded CV. Like the extraction provider, this
 * is the one place the app talks to a model about a CV, and everything above
 * it — the endpoint, the budget, the response — is written against `ReadCv`
 * and has never heard of Gemini.
 *
 * It shares nothing with job extraction but that boundary: its own model, its
 * own instructions, its own reply. The two read different documents for
 * different reasons and are not to be refactored together.
 */

/**
 * The model a PDF is read by. Its own constant rather than extraction's,
 * because reading a document and reading a web page are different jobs that
 * may want different models, and a shared name is how they would stop being
 * able to differ.
 *
 * Confirmed against ai.google.dev/gemini-api/docs/models on 2026-09-03 as the
 * current stable Pro model, and it is the Pro models that read PDFs natively —
 * which is the whole reason no parsing library is added here.
 */
export const CV_READING_MODEL = "gemini-2.5-pro";

/** One uploaded CV, as it arrives: the bytes, and what they were accepted as. */
export type CvFile = { bytes: Uint8Array; mediaType: CvMediaType };

/**
 * Reads a CV and answers with the document's text.
 *
 * An empty answer is a real one: the file held no text this could reach — a
 * scan, a mangled export, a PDF of nothing — and the endpoint turns it into
 * the message asking for a cleaner copy. So this rejects only when a provider
 * could not be asked or could not be understood, which is a different failure
 * and gets a different answer.
 */
export type ReadCv = (file: CvFile) => Promise<string>;

/**
 * Whether reading this file will ask the model anything. A PDF will: it is a
 * container the model reads natively, which is what keeps a parsing library
 * out of this app. A Markdown or plain text file will not — it already is its
 * text, and a model asked to hand a document back verbatim is a way to lose
 * some of it, not a way to read it.
 */
export function readingAsksTheModel(mediaType: CvMediaType): boolean {
  return mediaType === "application/pdf";
}

const INSTRUCTIONS = `You transcribe a CV so that it can be read as text.

Return the document's own words and nothing else. Do not summarise, do not rewrite, do not translate, and do not add headings, commentary or apologies of your own. Keep the order the document uses, keep each entry's dates and employer alongside it, and put every bullet on its own line.

Where the document is laid out in columns, read each column through rather than across, so that a line from one never lands in the middle of the other.

Return nothing at all if the document holds no text you can read — a scan with no text layer, or an empty file. An empty answer is the correct answer there.`;

/**
 * The Gemini implementation. Everything that can go wrong reaching it — no
 * key, no network, an exhausted quota, an empty reply object — leaves as a
 * rejection, because they all mean the same thing to the user: the reading did
 * not happen and it is not their file's fault.
 */
export const readCvWithGemini: ReadCv = async ({ bytes, mediaType }) => {
  if (!readingAsksTheModel(mediaType)) return decodedText(bytes);

  const response = await gemini().models.generateContent({
    model: CV_READING_MODEL,
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
    config: { systemInstruction: INSTRUCTIONS },
  });

  const { text } = response;
  if (text === undefined) {
    throw new Error(`${CV_READING_MODEL} answered with no content.`);
  }

  return text.trim();
};

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
