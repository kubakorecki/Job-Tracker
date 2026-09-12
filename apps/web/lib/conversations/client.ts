import { ApiRequestError, refusalIn, send } from "../api/client";
import {
  ConversationEvent,
  isEnding,
  REPLY_BROKE_OFF_MESSAGE,
  type ConversationView,
} from "./contract";

/**
 * The three Conversation endpoints, as the panel addresses them.
 *
 * Two of them are ordinary requests and go through `send` like everything
 * else. The third is the one response in this app that is not a JSON
 * document — a turn arrives a line at a time, because the flagship use is a
 * covering letter and a blank panel for twenty seconds is a feature used
 * once — so the reading of it is written here rather than in the component,
 * where it would be untestable and mixed up with drawing.
 *
 * A scope is a Job Application's id or the literal `general`, and the panel
 * never holds a Conversation's id: there are two kinds and no more, and where
 * the user is standing is the whole of the routing (`./scope.ts`).
 */

const conversationAt = (scope: string) => `/api/conversations/${scope}`;
const messagesAt = (scope: string) => `${conversationAt(scope)}/messages`;

/**
 * Everything said in this scope's Conversation, and whether there is a CV for
 * it to have read. A scope nobody has spoken in yet answers with an empty
 * list, not a failure.
 */
export async function fetchConversation(
  scope: string,
): Promise<ConversationView> {
  return send(conversationAt(scope));
}

/**
 * Empties this scope's Conversation and keeps it.
 *
 * Named for the Messages rather than the Conversation because that is what it
 * destroys: the scope keeps the one Conversation it is entitled to, and there
 * is no archive behind this — which is what the panel warns about before it
 * asks.
 */
export async function clearMessages(scope: string): Promise<void> {
  return send(messagesAt(scope), { method: "DELETE" });
}

/**
 * One turn: what the user said goes up, and the reply comes back in the pieces
 * it was written in.
 *
 * A refusal is thrown before anything is yielded, in the endpoint's own words,
 * because it happens before a byte of the reply exists — a spent allowance and
 * a model that could not be reached are different sentences and the panel
 * shows whichever it was given.
 *
 * A turn that stops without an ending is thrown too, and for the same reason
 * the endpoint sends exactly one: a panel left holding a reply that never
 * finishes would sit there writing for ever. What had arrived before it
 * stopped has already been yielded, and the endpoint has already written it
 * down as an incomplete Message (the spec's story 23).
 */
export async function* takeTurn(
  scope: string,
  text: string,
): AsyncGenerator<ConversationEvent> {
  const response = await fetch(messagesAt(scope), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) throw await refusalIn(response);
  if (response.body === null)
    throw new ApiRequestError([REPLY_BROKE_OFF_MESSAGE]);

  let ended = false;

  for await (const event of eventsIn(response.body)) {
    ended = isEnding(event);
    yield event;
  }

  if (!ended) throw new ApiRequestError([REPLY_BROKE_OFF_MESSAGE]);
}

/**
 * The body as the events it carries: one JSON object to a line.
 *
 * Nothing says a chunk is a line — a piece of the body can end mid-object and
 * two events can arrive in one — so the text is kept until a newline says an
 * object is whole. A reader that parsed whatever it was handed would throw
 * away the reply the first time a chunk landed in the middle of one.
 *
 * A line that is not JSON at all is passed over rather than thrown on. The one
 * way that happens is a connection dropping mid-line, and what came before it
 * is the paragraph the user is owed; the missing ending is what `takeTurn`
 * reports, which is the same thing said once rather than twice. A line that
 * *is* JSON and is not one of the agreed events is a different matter and
 * throws: both ends read their shape out of `./contract`, so that is a broken
 * contract rather than a broken connection, and silently dropping it would
 * leave the panel writing a reply that has already ended.
 */
async function* eventsIn(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ConversationEvent> {
  const bytes = body.getReader();
  // Decoded here rather than through a `TextDecoderStream` so that a chunk
  // ending in the middle of a multi-byte character is held over to the next
  // one — a covering letter is full of em dashes, and half of one is not a
  // character.
  const decoder = new TextDecoder();
  let held = "";

  for (;;) {
    const next = await bytes.read();
    if (next.done === true) return;

    held += decoder.decode(next.value, { stream: true });

    // Everything before the last newline is whole; whatever follows it is the
    // beginning of a line still arriving.
    const parts = held.split("\n");
    held = parts.pop() ?? "";

    for (const line of parts) {
      const json = parsed(line);
      if (json === null) continue;

      yield ConversationEvent.parse(json);
    }
  }
}

/** One line as whatever it is, or nothing where it is not JSON at all. */
function parsed(line: string): unknown {
  if (line.trim() === "") return null;

  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
