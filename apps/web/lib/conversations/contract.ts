import { Message } from "@repo/schema";
import { z } from "zod";

/**
 * What a client sends to take a turn, and what it reads back while the reply
 * is being written.
 *
 * A turn is the one thing in this product that cannot be a single JSON
 * response: the flagship use is a covering letter, and a blank panel for
 * twenty seconds is a feature used once. So the reply arrives as a stream of
 * events, one JSON object per line, and this module is where their shape is
 * agreed rather than in the endpoint and again in the panel.
 *
 * Newline-delimited JSON rather than Server-Sent Events: a turn is a `POST`,
 * which `EventSource` cannot make, so the panel is reading the body itself
 * either way — and a line of JSON needs no framing rules of its own.
 */

/**
 * How much one Message may carry. A Message is a question, an instruction or
 * a draft to work on; everything the model needs to answer about — the Job
 * Application, the Posting's description, the CV — is assembled by the server
 * and was never the user's to paste in (ADR-0008). The bound exists because
 * an unbounded body is an unbounded prompt, and it is set well above anything
 * a person types into a panel.
 */
export const MAX_MESSAGE_LENGTH = 20_000;

/**
 * One turn, as the panel sends it. Nothing else: which Conversation it belongs
 * to is the address, and who is speaking is decided by the endpoint rather
 * than claimed by the caller — a client that could name a role could put words
 * in the model's mouth and have them read back as the model's own.
 */
export const SaidMessage = z.object({
  text: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});
export type SaidMessage = z.infer<typeof SaidMessage>;

/**
 * What arrives on the stream, in the order it arrives: the user's Message as
 * it was persisted, then the reply in pieces, then exactly one ending — either
 * the Message that was kept, or the same Message marked incomplete and the
 * sentence saying the reply broke off.
 *
 * Both endings carry the persisted Message rather than leaving the panel to
 * assemble one out of the pieces it drew. It is the row a reload would read
 * back, ids and timestamp and all, so what the panel shows after a turn and
 * what it shows tomorrow come from one place and cannot drift apart.
 *
 * A provider that could not be reached at all is not an event here. Nothing of
 * the reply had arrived, so the turn is refused before the stream begins, with
 * a status and the one error shape every other endpoint answers with.
 */
export const ConversationEvent = z.discriminatedUnion("event", [
  /** The user's Message, as it was written down. */
  z.object({ event: z.literal("asked"), message: Message }),
  /** A piece of the reply, exactly as the model wrote it. */
  z.object({ event: z.literal("wrote"), text: z.string() }),
  /** The reply, whole, and the Message it was kept as. */
  z.object({ event: z.literal("finished"), message: Message }),
  /** The reply stopped partway. What arrived is in `message`. */
  z.object({
    event: z.literal("broke-off"),
    message: Message,
    error: z.string(),
  }),
]);
export type ConversationEvent = z.infer<typeof ConversationEvent>;

/** The media type the stream of events is sent as. */
export const CONVERSATION_STREAM_MEDIA_TYPE = "application/x-ndjson";
