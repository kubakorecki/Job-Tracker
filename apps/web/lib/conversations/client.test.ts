import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../api/client";
import { fetchConversation, clearMessages, takeTurn } from "./client";
import {
  CONVERSATION_STREAM_MEDIA_TYPE,
  GENERAL_SCOPE,
  REPLY_BROKE_OFF_MESSAGE,
  type ConversationEvent,
} from "./contract";

/**
 * How the panel talks to the three Conversation endpoints — and, the part
 * worth testing, how it reads a reply that arrives a piece at a time.
 *
 * A turn is the one response in the app that is not a JSON document, so the
 * line-by-line reading is written here rather than in the panel. The network
 * is stood in for: what these prove is that the panel makes the right request
 * and gets the agreed events out of a body, however it was chopped up on the
 * way.
 */

/** Real ids: both ends read the events' shape out of the contract. */
const CONVERSATION_ID = "0f1e2d3c-4b5a-4968-8776-655443332211";

const ASKED: ConversationEvent = {
  event: "asked",
  message: {
    id: "3f4a1c2e-8b7d-4e5f-9a0b-1c2d3e4f5a6b",
    conversationId: CONVERSATION_ID,
    role: "user",
    text: "Write me a covering letter.",
    incomplete: false,
    saidAt: "2026-09-12T09:00:00.000Z",
  },
};

const FINISHED: ConversationEvent = {
  event: "finished",
  message: {
    ...ASKED.message,
    id: "7c6b5a49-3827-4615-9304-f2e1d0c9b8a7",
    role: "model",
    text: "Dear…",
  },
};

/** A response whose body arrives in exactly these pieces. */
function streamed(pieces: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(encoder.encode(piece));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "content-type": CONVERSATION_STREAM_MEDIA_TYPE },
    },
  );
}

/** The lines a turn would really be sent as. */
const lines = (...events: ConversationEvent[]) =>
  events.map((event) => `${JSON.stringify(event)}\n`).join("");

/** Stands in for the network, and keeps what was asked of it. */
function answering(...responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let next = 0;

  const fetching = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return responses[next++] ?? new Response(null, { status: 204 });
  });

  vi.stubGlobal("fetch", fetching);

  return calls;
}

async function drain(
  events: AsyncGenerator<ConversationEvent>,
): Promise<ConversationEvent[]> {
  const kept: ConversationEvent[] = [];
  for await (const event of events) kept.push(event);
  return kept;
}

afterEach(() => vi.unstubAllGlobals());

describe("reading a Conversation back", () => {
  it("asks the scope's own address for it", async () => {
    const calls = answering(
      Response.json({ messages: [ASKED.message], cvAttached: true }),
    );

    expect(await fetchConversation(GENERAL_SCOPE)).toEqual({
      messages: [ASKED.message],
      cvAttached: true,
    });
    expect(calls[0]?.url).toBe("/api/conversations/general");
  });
});

describe("clearing a Conversation", () => {
  it("deletes the Messages and not the Conversation", async () => {
    const calls = answering(new Response(null, { status: 204 }));

    await clearMessages("job-application-id");

    expect(calls[0]?.url).toBe(
      "/api/conversations/job-application-id/messages",
    );
    expect(calls[0]?.init?.method).toBe("DELETE");
  });
});

describe("taking a turn", () => {
  it("sends what was said to the scope's own address", async () => {
    const calls = answering(streamed([lines(ASKED, FINISHED)]));

    await drain(takeTurn(GENERAL_SCOPE, "Write me a covering letter."));

    expect(calls[0]?.url).toBe("/api/conversations/general/messages");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      text: "Write me a covering letter.",
    });
  });

  it("gives up each event as it arrives", async () => {
    answering(
      streamed([
        lines(ASKED),
        lines({ event: "wrote", text: "Dear…" }),
        lines(FINISHED),
      ]),
    );

    expect(await drain(takeTurn(GENERAL_SCOPE, "Go on."))).toEqual([
      ASKED,
      { event: "wrote", text: "Dear…" },
      FINISHED,
    ]);
  });

  it("reads an event split across two pieces of the body", async () => {
    // Nothing says a chunk is a line. A reader that parsed what it was handed
    // would throw away the reply the moment one landed mid-object.
    const whole = lines(ASKED, FINISHED);
    answering(streamed([whole.slice(0, 30), whole.slice(30)]));

    expect(await drain(takeTurn(GENERAL_SCOPE, "Go on."))).toEqual([
      ASKED,
      FINISHED,
    ]);
  });

  it("keeps the pieces it could read of a body that stopped mid-line", async () => {
    // A connection that drops mid-line leaves half an event behind it. What
    // came before it is the paragraph the user is owed.
    const whole = lines(ASKED, { event: "wrote", text: "Dear…" }, FINISHED);
    answering(streamed([whole.slice(0, whole.length - 20)]));

    const read = takeTurn(GENERAL_SCOPE, "Go on.");
    const kept: ConversationEvent[] = [];

    await expect(async () => {
      for await (const event of read) kept.push(event);
    }).rejects.toThrow(REPLY_BROKE_OFF_MESSAGE);

    expect(kept).toEqual([ASKED, { event: "wrote", text: "Dear…" }]);
  });

  it("says the reply broke off where no ending arrived", async () => {
    // The endpoint sends exactly one ending. A stream that stops without one
    // stopped on the way, and the panel has to say so rather than sit there
    // with a reply that never finishes.
    answering(streamed([lines(ASKED, { event: "wrote", text: "Dear…" })]));

    await expect(drain(takeTurn(GENERAL_SCOPE, "Go on."))).rejects.toThrow(
      REPLY_BROKE_OFF_MESSAGE,
    );
  });

  it("does not complain about a reply that broke off on the server", async () => {
    // That one is an ending, and it carries the Message that was kept.
    const brokeOff: ConversationEvent = {
      event: "broke-off",
      message: { ...FINISHED.message, incomplete: true },
      error: REPLY_BROKE_OFF_MESSAGE,
    };
    answering(streamed([lines(ASKED, brokeOff)]));

    expect(await drain(takeTurn(GENERAL_SCOPE, "Go on."))).toEqual([
      ASKED,
      brokeOff,
    ]);
  });

  it("refuses in the endpoint's own words", async () => {
    // A spent allowance, an unreachable model and a rejected Message read
    // differently to the user, and the sentence that says which is the
    // endpoint's rather than the panel's.
    answering(
      Response.json(
        { error: "You have spent this month's AI Usage." },
        { status: 429 },
      ),
    );

    await expect(drain(takeTurn(GENERAL_SCOPE, "Go on."))).rejects.toThrow(
      new ApiRequestError(["You have spent this month's AI Usage."]),
    );
  });
});
