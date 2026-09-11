import type { Message } from "@repo/schema";
import { recordAiUsage } from "../ai-usage/repository";
import type { MessageRow } from "../db/schema";
import {
  CONVERSATION_STREAM_MEDIA_TYPE,
  type ConversationEvent,
} from "./contract";
import type { StreamedReply } from "./provider";
import { appendMessage } from "./repository";
import { messageFrom } from "./view";

/**
 * A turn on its way to the panel: the reply written out as it arrives, and
 * written down whatever happens to it.
 *
 * It is its own module because it changes for its own reasons. The endpoints
 * beside it decide who may take a turn and what it costs; this decides what a
 * turn looks like on the wire and what is kept when one ends badly — and the
 * only thing still running once a reply is being streamed is this.
 *
 * That last part is the whole of why the writing lives here rather than in the
 * handler. A browser that goes away cancels the response, and the endpoint's
 * own loop goes down with it: the generator below is what is left to keep the
 * paragraph that had arrived (the spec's story 23).
 */

/** What the user is told when a reply stopped partway through. */
export const REPLY_BROKE_OFF_MESSAGE =
  "The reply broke off before it was finished. What arrived is kept below; ask again for the rest.";

/** One turn, as everything it takes to write it down and send it on. */
export type StreamedTurn = {
  userId: string;
  conversationId: string;
  /** The user's Message, as it was written down. */
  asked: MessageRow;
  /** The reply, already begun. */
  reply: StreamedReply;
  /** What of it had arrived by the time the turn was answered. */
  arrived: string;
};

/**
 * The turn as a response: one JSON event to a line, as it happens.
 *
 * Nothing may hold it back or hand it out again — a reply is written once, to
 * one person, and a cached or buffered one is a reply that arrives all at once
 * at the end, which is the thing streaming exists to prevent.
 */
export function streamedTurn(turn: StreamedTurn): Response {
  return new Response(streamOf(encoded(turnEvents(turn))), {
    status: 200,
    headers: {
      "content-type": CONVERSATION_STREAM_MEDIA_TYPE,
      "cache-control": "no-store",
    },
  });
}

/**
 * One turn as the panel reads it: the Message that was written down, the reply
 * in the pieces it arrived in, and exactly one ending.
 *
 * Every path out of here writes the reply down exactly once — it finished, it
 * broke off, or nobody is reading any more — because what arrived is what the
 * user is owed, and the three differ only in what they are told about it.
 */
async function* turnEvents({
  userId,
  conversationId,
  asked,
  reply,
  arrived,
}: StreamedTurn): AsyncGenerator<ConversationEvent> {
  let kept: Message | null = null;

  /** What arrived, written down once however this turn ends. */
  const keep = async (incomplete: boolean): Promise<Message> => {
    if (kept !== null) return kept;

    const { answer, tokens } = reply.soFar();
    kept = messageFrom(
      await appendMessage(userId, conversationId, {
        role: "model",
        text: answer,
        incomplete,
      }),
    );

    // What the turn cost, recorded after the reply it paid for is safely
    // stored: a meter that failed to write would otherwise throw away prose
    // the user has already spent their month on, which is the worse of the two
    // failures.
    await recordAiUsage(userId, tokens);

    return kept;
  };

  // Nothing else runs to tell these apart, so the outcome is carried rather
  // than inferred: a reader that went away leaves this at `abandoned`, which
  // is as incomplete as a reply that broke off.
  let outcome: "abandoned" | "finished" | "broke-off" = "abandoned";

  try {
    yield { event: "asked", message: messageFrom(asked) };
    yield { event: "wrote", text: arrived };

    for (;;) {
      let next: IteratorResult<string>;

      // The `yield` below sits outside this `try` deliberately. A reader that
      // throws while handling a chunk has it thrown back in at the yield, and
      // catching it here would dress the reader's own failure up as the
      // provider's.
      try {
        next = await reply.next();
      } catch {
        outcome = "broke-off";
        break;
      }

      if (next.done === true) {
        outcome = "finished";
        break;
      }

      yield { event: "wrote", text: next.value };
    }

    const message = await keep(outcome !== "finished");

    yield outcome === "broke-off"
      ? { event: "broke-off", message, error: REPLY_BROKE_OFF_MESSAGE }
      : { event: "finished", message };
  } finally {
    if (outcome === "abandoned") {
      // Nobody is reading any more. Ending the provider's stream stops a reply
      // being written into nothing, and what had arrived by then is kept as
      // the partial thing it is.
      await reply.return(undefined);
      await keep(true);
    }
  }
}

/** The events as they go down the wire: one JSON object to a line. */
async function* encoded(
  events: AsyncGenerator<ConversationEvent>,
): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();

  for await (const event of events) {
    yield encoder.encode(`${JSON.stringify(event)}\n`);
  }
}

/**
 * The lines as a response body.
 *
 * Written out rather than taken from a helper because of the last two
 * arrangements. A reader that goes away has to reach the generator above, and
 * a stream that dropped the cancellation would leave a turn's last paragraph
 * unwritten and the provider's connection open behind it.
 */
function streamOf(
  lines: AsyncGenerator<Uint8Array>,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    // Begun here rather than left until the first read. A reader that goes
    // away without reading a byte cancels this, and a generator that had never
    // started has no `finally` to run — the paragraph that had already arrived
    // would go with the connection.
    async start(controller) {
      await forward(lines, controller);
    },
    async pull(controller) {
      await forward(lines, controller);
    },
    async cancel() {
      await lines.return(undefined);
    },
  });
}

/** One line onto the stream, or the end of it. */
async function forward(
  lines: AsyncGenerator<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  const next = await lines.next();

  if (next.done === true) controller.close();
  else controller.enqueue(next.value);
}
