import {
  GoogleGenAI,
  type Content,
  type GenerateContentResponseUsageMetadata,
} from "@google/genai";
import type { Message, MessageRole } from "@repo/schema";
import { tokensReported, type Metered } from "../ai-usage/metered";
import { geminiApiKey } from "../env";

/**
 * The one place this app asks the model to talk. Everything above it — the
 * endpoints, the two limits, the panel — is written against
 * `StreamConversation` and has never heard of Gemini, which is what makes this
 * both the swap point for a second provider and the substitution point for the
 * endpoints' tests: every path through a turn is exercisable with no API key
 * and no network.
 *
 * It shares nothing with job extraction, CV reading or the analyser but that
 * boundary and the meter behind it: its own model, its own instructions —
 * assembled in `context.ts`, which is the only thing that writes them — and
 * its own reply shape. The four are not to be refactored together. This is
 * also the one call in the product with no response schema, because it is the
 * one that answers in prose; a schema here would be a form, and a form is what
 * the whole Conversation exists to be an alternative to.
 *
 * The model is given no tools and no function declarations, here or anywhere.
 * What it knows is what the server assembled and handed over (ADR-0008).
 */

/**
 * The model a Conversation runs on. Its own constant rather than extraction's,
 * the CV reader's or the Analysis's, because talking to the user and reading a
 * document are different jobs that may want different models, and a shared
 * name is how they would stop being able to differ — the reason the existing
 * three each state.
 *
 * It is `gemini-2.5-pro`, the identifier the other three were confirmed
 * against at ai.google.dev/gemini-api/docs/models on 2026-09-03 as the current
 * stable Pro model; verify it there before changing it, as their comments do.
 * The Pro model rather than a cheaper one because the flagship use is a
 * covering letter written from a CV and a Posting — the prose is the product
 * here, and a Flash draft of it is a thing the user rewrites themselves.
 */
export const CONVERSATION_MODEL = "gemini-2.5-pro";

/**
 * One Message already in the Conversation, as a provider is handed it: who
 * said it and what they said, and nothing else.
 *
 * Structural, so a row read from the repository satisfies it without being
 * converted first. The ids and the timestamps are deliberately not here — a
 * provider that never sees an id cannot name one, and when something was said
 * is the panel's business rather than the model's.
 */
export type PriorMessage = Pick<Message, "role" | "text">;

/**
 * One turn, as it is asked: the system instruction this turn was assembled
 * with, the Conversation as it stood before this turn, and the thing the user
 * has just said.
 *
 * `said` is separate from `priorMessages` rather than appended to it by the
 * caller, so that "what is being answered" is a fact about the request rather
 * than a convention about the last element of an array. It is also the one
 * thing a caller can get wrong here: the endpoint persists the user's Message
 * before it assembles, so a caller that read the Conversation back out of the
 * database after that write would hold the just-said Message in
 * `priorMessages` and pass it again as `said` — and the model would be asked
 * the same question twice. `priorMessages` is what was said *before* this
 * turn.
 *
 * Nothing here is a `userId`: the scoping happened in the repository and the
 * assembly happened above this (ADR-0001, ADR-0008).
 */
export type ConversationTurn = {
  instructions: string;
  priorMessages: readonly PriorMessage[];
  said: string;
};

/**
 * A reply as it arrives: the prose in chunks, and `soFar` — what has arrived
 * and what it has cost, at any moment.
 *
 * `soFar` is the whole of how a caller reads a turn, on every path through it:
 * a reply that finished, one that broke off mid-sentence, and one the caller
 * itself abandoned all leave the same two facts in the same place. That is not
 * a convenience. A browser that goes away takes the endpoint's own loop down
 * with it, and a reply readable only through a return value or a thrown error
 * would lose both the prose and the tokens in exactly the case the product
 * promises to keep them (the spec's story 23, ADR-0009).
 *
 * It is a stream of prose and not of events, because there is one kind of
 * thing to send to the panel and a reply is the only thing this call produces.
 */
export type StreamedReply = AsyncGenerator<string, void> & {
  soFar: () => Metered<string>;
};

/**
 * Answers one turn of a Conversation, streaming, because the flagship use is a
 * covering letter and a blank panel for twenty seconds is a feature used once.
 *
 * A turn that cannot be delivered whole rejects with `PartialReply`, and what
 * had arrived by then is on `soFar`. There is nothing this answers with
 * instead of rejecting: an empty reply is a failure here rather than an empty
 * answer, because prose is the only thing a Conversation produces and none of
 * it is nothing to show the user.
 */
export type StreamConversation = (turn: ConversationTurn) => StreamedReply;

/**
 * A reply the provider did not deliver whole: the connection dropped, the
 * stream errored, it failed before a word arrived, or it ran to its end having
 * said nothing at all.
 *
 * It carries no prose and no tokens of its own, because both are on the
 * stream's `soFar` and one fact in two places is one fact that can disagree
 * with itself. A caller's rule is the same whatever it catches: persist
 * `soFar().answer` where there is any, record `soFar().tokens` either way, and
 * tell the user the reply broke off where prose arrived and that the model
 * could not be reached where none did (the spec's stories 22 and 23).
 */
export class PartialReply extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartialReply";
  }
}

/**
 * One chunk of a provider's stream, as the reader below is handed it: whatever
 * prose it carried, and whatever it said about what the call has cost so far.
 *
 * Structural rather than the SDK's own response type, so that the reader is
 * testable with a handful of objects — which is the whole of how a partial
 * stream is exercised without a network able to fail on cue.
 */
export type ReplyChunk = {
  text?: string | undefined;
  usageMetadata?: GenerateContentResponseUsageMetadata | undefined;
};

/**
 * The Gemini implementation: a stream of chunks, read as a reply.
 *
 * No `responseMimeType` and no schema, unlike every other call in the product.
 * The instructions are passed through exactly as `context.ts` assembled them,
 * and nothing in this module adds a word to them: there is one place that
 * decides what the model is told, and a provider that appended its own
 * sentence would quietly be a second.
 */
export const streamConversationWithGemini: StreamConversation = (turn) =>
  replyFrom(geminiChunks(turn));

/** The provider's own stream, started on the first chunk the caller asks for. */
async function* geminiChunks(
  turn: ConversationTurn,
): AsyncGenerator<ReplyChunk> {
  const stream = await gemini().models.generateContentStream({
    model: CONVERSATION_MODEL,
    contents: contentsFor(turn),
    config: { systemInstruction: turn.instructions },
  });

  yield* stream;
}

/**
 * The turn as the provider is given it: the Conversation in its own multi-turn
 * shape, one entry per Message, and what the user has just said last.
 *
 * One entry each rather than a transcript concatenated into a single string —
 * a model handed the Conversation as one block of text is reading a quotation
 * of a conversation rather than remembering one, and the roles it would have
 * to infer from labels are roles the provider has a field for.
 *
 * A Message with nothing in it is left out. A reply that failed before a word
 * arrived is still persisted as a Message, so an empty one is an ordinary row
 * rather than a broken one, and sending it back would be telling the model it
 * once took a turn it did not.
 *
 * A Message's role is written out through `PROVIDER_ROLES` rather than passed
 * along as itself. `MessageRole` happens to be the provider's own word for
 * each of the two, and a coincidence relied on quietly is one a third role
 * breaks quietly; the map makes that a type error in this file.
 */
export function contentsFor({
  priorMessages,
  said,
}: ConversationTurn): Content[] {
  return [
    ...priorMessages
      .filter((message) => !isBlank(message.text))
      .map((message): Content => ({
        role: PROVIDER_ROLES[message.role],
        parts: [{ text: message.text }],
      })),
    { role: PROVIDER_ROLES.user, parts: [{ text: said }] },
  ];
}

/** What the provider calls each of the two roles a Message can carry. */
const PROVIDER_ROLES: Record<MessageRole, "user" | "model"> = {
  user: "user",
  model: "model",
};

/**
 * A stream of chunks, read as a reply: the prose yielded on as it arrives, and
 * what has arrived readable at any moment through `soFar`.
 *
 * The running total lives out here rather than inside the generator so that it
 * outlives it. A generator abandoned halfway — the caller broke out of its
 * loop, or its own write failed — runs no more code and answers no more
 * questions, and a reply readable only on the way out would be a reply lost in
 * exactly the case worth keeping.
 */
export function replyFrom(chunks: AsyncIterable<ReplyChunk>): StreamedReply {
  const arrived: Arrived = { text: "", tokens: 0 };

  return Object.assign(reading(chunks, arrived), {
    // Whitespace is nothing, and comes back as nothing: `contentsFor` above
    // drops a Message of nothing but whitespace, so a reply of it persisted
    // here would vanish from the next turn — a blank turn in the panel, a turn
    // later. Prose that arrived is given back exactly as it was streamed,
    // because the caller draws one and persists the other.
    soFar: (): Metered<string> => ({
      answer: isBlank(arrived.text) ? "" : arrived.text,
      tokens: arrived.tokens,
    }),
  });
}

/**
 * The stream itself, yielding prose and recording what it has cost into the
 * total its caller holds.
 *
 * The iterator is stepped by hand rather than with `for await` so that the
 * `yield` sits outside the `try`. A caller that throws while handling a chunk —
 * a response stream closed under it, a bug of its own — has that thrown back
 * into this generator at the yield, and a `try` around the yield would catch it
 * and dress the caller's own failure up as the provider's.
 */
async function* reading(
  chunks: AsyncIterable<ReplyChunk>,
  arrived: Arrived,
): AsyncGenerator<string, void> {
  const stream = chunks[Symbol.asyncIterator]();

  for (;;) {
    let next: IteratorResult<ReplyChunk>;

    try {
      next = await stream.next();
    } catch (cause) {
      throw new PartialReply(
        `${CONVERSATION_MODEL} stopped partway through its reply: ${String(cause)}`,
      );
    }

    if (next.done === true) {
      // A stream that ran to its end and said nothing is not a reply. A
      // Message of no words is a blank turn in the panel, which the user reads
      // as the product breaking quietly, so it leaves the way a stream that
      // broke off does — and the caller tells the two apart by whether any
      // prose arrived rather than by a second kind of failure. A model stopped
      // by its own safety filter ends this way, having read the prompt and
      // been paid for it (ADR-0009).
      if (isBlank(arrived.text)) {
        throw new PartialReply(
          `${CONVERSATION_MODEL} answered with no content.`,
        );
      }

      return;
    }

    const chunk = next.value;

    // What the call has cost so far, as the provider reports it: a streamed
    // usage block is the whole call to this point rather than this chunk's
    // share, so the last one to carry any is the turn's — and adding them up
    // would count the prompt once per chunk. A chunk that reports none has not
    // revised anything, so what the one before it said stands (ADR-0009).
    if (chunk.usageMetadata !== undefined) {
      arrived.tokens = tokensReported(chunk.usageMetadata);
    }

    // The final chunk of a Gemini stream carries the usage and no prose, and
    // an empty chunk sent on to the panel is an event that renders nothing.
    // `text` skips the model's own thinking, so what is yielded is the reply
    // the user is being written.
    if (chunk.text === undefined || chunk.text === "") continue;

    arrived.text += chunk.text;
    yield chunk.text;
  }
}

/**
 * What has arrived of a reply: the prose so far and what the provider has said
 * it cost so far. Written into by the stream and read by `soFar`, which is the
 * one thing they have to share and the reason it is a mutable record rather
 * than a value either of them owns.
 */
type Arrived = { text: string; tokens: number };

/**
 * Whether a Message has anything in it. One rule, read in both directions: a
 * reply of nothing but whitespace is not a reply, and a Message of it is not
 * sent back as a turn the model took.
 */
function isBlank(text: string): boolean {
  return text.trim() === "";
}

let client: GoogleGenAI | null = null;

/**
 * Built on first use rather than at module load, so importing the endpoints —
 * which every test of them does — costs no API key.
 */
function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: geminiApiKey() });
  return client;
}
