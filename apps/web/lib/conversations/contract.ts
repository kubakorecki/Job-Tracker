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
 *
 * Everything here is read by both ends, so nothing here may reach the
 * database. The panel imports this module into the browser, and a constant
 * kept beside the endpoint that uses it would drag a repository in with it.
 */

/**
 * The one scope that is not an id. A literal rather than an empty segment or a
 * separate address, so that the three routes have one shape between them and a
 * client builds a URL the same way wherever the user is standing.
 */
export const GENERAL_SCOPE = "general";

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

/**
 * Whether this event is the one that ends a turn.
 *
 * Stated here because "exactly one ending" is a rule of the wire rather than
 * of either end: the endpoint promises to send one, and the panel is entitled
 * to treat a stream that stopped without one as a turn that broke off.
 */
export function isEnding(event: ConversationEvent): boolean {
  return event.event === "finished" || event.event === "broke-off";
}

/** The media type the stream of events is sent as. */
export const CONVERSATION_STREAM_MEDIA_TYPE = "application/x-ndjson";

/**
 * What the user is told when a reply stopped partway through.
 *
 * One sentence for the two ways it happens — the endpoint watching the
 * provider stop, and the panel watching the stream stop — because they are the
 * same thing to the person reading the half-written paragraph. It is also what
 * the panel says beside an incomplete Message read back tomorrow, which is why
 * it is agreed here rather than sent only in the event that broke.
 */
export const REPLY_BROKE_OFF_MESSAGE =
  "The reply broke off before it was finished. What arrived is kept below; ask again for the rest.";

/**
 * A Conversation as the panel opens it: everything said in it, oldest first,
 * and whether there is a CV for it to have read.
 *
 * The CV is here rather than asked for separately because it is a fact about
 * what this Conversation can see, and the panel needs both at the one moment —
 * it has to be able to say plainly that no CV is attached before the user
 * trusts an answer, rather than after (the spec's story 19). It is a boolean
 * and not the Profile: what the document says is the model's to read, and a
 * panel that asked for the Profile would mint a signed URL to answer a
 * yes-or-no question.
 */
export const ConversationView = z.object({
  messages: z.array(Message),
  cvAttached: z.boolean(),
});
export type ConversationView = z.infer<typeof ConversationView>;
