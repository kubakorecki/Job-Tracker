import { describe, expect, it } from "vitest";
import {
  contentsFor,
  PartialReply,
  replyFrom,
  type ReplyChunk,
  type StreamedReply,
} from "./provider";

/**
 * The two halves of the provider that need no network: what a turn is sent as,
 * and what a stream of chunks amounts to. Reaching Gemini is not tested here —
 * the endpoints substitute the whole function for that, as they do the
 * analyser and the CV reader — but the multi-turn shape and the reading of a
 * stream that does not finish are decisions this module makes on its own, and
 * the ones a caller cannot see having gone wrong.
 */

describe("what a turn is sent as", () => {
  it("sends each prior Message as its own turn, in the order they were said", () => {
    // Not concatenated into one string: the prior Messages go in the
    // provider's own multi-turn shape, and a transcript pasted into one user
    // turn is a model reading a quotation of a conversation rather than
    // remembering one.
    expect(
      contentsFor({
        instructions: "You are the assistant inside Job Tracker.",
        priorMessages: [
          { role: "user", text: "Is this job worth applying for?" },
          { role: "model", text: "On the requirements, yes." },
        ],
        said: "Then write me a covering letter.",
      }),
    ).toEqual([
      { role: "user", parts: [{ text: "Is this job worth applying for?" }] },
      { role: "model", parts: [{ text: "On the requirements, yes." }] },
      { role: "user", parts: [{ text: "Then write me a covering letter." }] },
    ]);
  });

  it("sends a first turn as the one thing said", () => {
    expect(
      contentsFor({
        instructions: "You are the assistant inside Job Tracker.",
        priorMessages: [],
        said: "What should I chase this week?",
      }),
    ).toEqual([
      { role: "user", parts: [{ text: "What should I chase this week?" }] },
    ]);
  });

  it("leaves out a prior Message with nothing in it", () => {
    // A reply that failed before a word of it arrived is still persisted as a
    // Message, so an empty one is an ordinary row rather than a broken one —
    // and sending it back would be telling the model it once took a turn it
    // did not.
    const sent = (text: string) =>
      contentsFor({
        instructions: "You are the assistant inside Job Tracker.",
        priorMessages: [
          { role: "user", text: "Write me a covering letter." },
          { role: "model", text },
        ],
        said: "Try that again.",
      });

    const withoutIt = [
      { role: "user", parts: [{ text: "Write me a covering letter." }] },
      { role: "user", parts: [{ text: "Try that again." }] },
    ];

    expect(sent("")).toEqual(withoutIt);
    expect(sent("\n  ")).toEqual(withoutIt);
  });
});

describe("reading a streamed reply", () => {
  it("yields each chunk of prose as it arrives", async () => {
    const reply = replyFrom(
      streamOf([
        { text: "Dear hiring manager," },
        { text: " I am writing" },
        { text: " about the Platform Engineer role." },
      ]),
    );

    expect(await drained(reply)).toEqual([
      "Dear hiring manager,",
      " I am writing",
      " about the Platform Engineer role.",
    ]);
  });

  it("holds the whole reply, assembled, once it has finished", async () => {
    // The caller streams the chunks on and reads the whole of it off the same
    // reply at the end, so persisting the Message is not a second
    // accumulation of the same prose in the endpoint.
    const reply = replyFrom(
      streamOf([{ text: "Dear hiring" }, { text: " manager," }]),
    );
    await drained(reply);

    expect(reply.soFar().answer).toBe("Dear hiring manager,");
  });

  it("yields nothing for a chunk carrying no prose", async () => {
    // The final chunk of a Gemini stream often carries usage and no text, and
    // an empty chunk sent on to the panel is an event that renders nothing.
    const reply = replyFrom(
      streamOf([
        { text: "Dear hiring manager," },
        { text: "" },
        { usageMetadata: { promptTokenCount: 8_000 } },
      ]),
    );

    expect(await drained(reply)).toEqual(["Dear hiring manager,"]);
  });

  it("counts the usage the last chunk to report any", async () => {
    // Gemini's streamed usage is cumulative rather than per-chunk, so the last
    // figure is the whole call's and summing them would count the prompt once
    // per chunk.
    const reply = replyFrom(
      streamOf([
        {
          text: "Dear hiring manager,",
          usageMetadata: { promptTokenCount: 8_000 },
        },
        {
          text: " I am writing.",
          usageMetadata: {
            promptTokenCount: 8_000,
            candidatesTokenCount: 400,
            thoughtsTokenCount: 600,
          },
        },
      ]),
    );
    await drained(reply);

    expect(reply.soFar().tokens).toBe(9_000);
  });

  it("counts a stream that said nothing about its usage as nothing spent", async () => {
    const reply = replyFrom(streamOf([{ text: "A letter." }]));
    await drained(reply);

    expect(reply.soFar().tokens).toBe(0);
  });
});

describe("a reply that does not finish", () => {
  it("keeps what arrived, rather than throwing away a good first paragraph", async () => {
    const reply = replyFrom(
      streamOf(
        [
          {
            text: "Dear hiring manager,",
            usageMetadata: { promptTokenCount: 8_000 },
          },
          { text: " I am writing" },
        ],
        new Error("the connection dropped"),
      ),
    );

    await expect(drained(reply)).rejects.toThrow(PartialReply);
    expect(reply.soFar().answer).toBe("Dear hiring manager, I am writing");
  });

  it("surfaces the failure alongside it, rather than ending as though it finished", async () => {
    const reply = replyFrom(
      streamOf([{ text: "Dear" }], new Error("503 from upstream")),
    );

    await expect(drained(reply)).rejects.toThrow("503 from upstream");
  });

  it("counts what the provider had already billed for", async () => {
    // The prompt and the model's thinking were spent before the stream broke,
    // and a partial reply is the expensive failure rather than the free one
    // (ADR-0009).
    const reply = replyFrom(
      streamOf(
        [
          {
            text: "Dear hiring manager,",
            usageMetadata: {
              promptTokenCount: 8_000,
              thoughtsTokenCount: 600,
            },
          },
        ],
        new Error("the connection dropped"),
      ),
    );

    await expect(drained(reply)).rejects.toThrow(PartialReply);
    expect(reply.soFar().tokens).toBe(8_600);
  });

  it("keeps what arrived when the caller is the one that failed", async () => {
    // A browser that goes away takes the endpoint's own loop down with it, and
    // that is the likeliest way a reply breaks off. The reply is still there
    // to be persisted and still says what it cost, which is the whole reason
    // the running total outlives the stream.
    const reply = replyFrom(
      streamOf([
        {
          text: "Dear hiring manager,",
          usageMetadata: { promptTokenCount: 8_000 },
        },
        { text: " I am writing" },
      ]),
    );

    for await (const chunk of reply) {
      expect(chunk).toBe("Dear hiring manager,");
      break;
    }

    expect(reply.soFar()).toEqual({
      answer: "Dear hiring manager,",
      tokens: 8_000,
    });
  });

  it("does not dress a caller's own failure up as the provider's", async () => {
    // A caller that throws while handling a chunk hears its own error back,
    // because calling that a partial reply would hide it behind a message
    // about the model.
    const reply = replyFrom(streamOf([{ text: "Dear" }, { text: " sir" }]));
    const mine = new Error("the browser went away");

    await reply.next();

    await expect(reply.throw(mine)).rejects.toBe(mine);
    expect(reply.soFar().answer).toBe("Dear");
  });

  it("carries no prose where the provider was never reached at all", async () => {
    // No key, no network, a refused request: nothing arrived, which is how the
    // endpoint tells "the reply broke off" from "there was no reply".
    const reply = replyFrom(
      streamOf([], new Error("GEMINI_API_KEY is not set")),
    );

    await expect(drained(reply)).rejects.toThrow(PartialReply);
    expect(reply.soFar()).toEqual({ answer: "", tokens: 0 });
  });

  it("rejects a stream that ran to its end having said nothing", async () => {
    // A model stopped by its own safety filter ends this way. A Message of no
    // words is a blank turn in the panel and reads as the product breaking
    // quietly, so it leaves as the failure it is — still carrying what the
    // prompt was billed at.
    const reply = replyFrom(
      streamOf([{ usageMetadata: { promptTokenCount: 8_000 } }]),
    );

    await expect(drained(reply)).rejects.toThrow("answered with no content");
    expect(reply.soFar()).toEqual({ answer: "", tokens: 8_000 });
  });

  it("rejects a stream whose whole reply was whitespace", async () => {
    // `contentsFor` leaves a Message of nothing but whitespace out of the next
    // turn, so keeping one as an answer would persist a Message that then
    // vanished — the blank turn, a turn later.
    const reply = replyFrom(streamOf([{ text: "  \n " }]));

    await expect(drained(reply)).rejects.toThrow(PartialReply);
    expect(reply.soFar().answer).toBe("");
  });
});

/** A provider's stream, and the way it ends, as the reader is handed it. */
async function* streamOf(
  chunks: readonly ReplyChunk[],
  fails?: Error,
): AsyncGenerator<ReplyChunk> {
  for (const chunk of chunks) yield chunk;
  if (fails !== undefined) throw fails;
}

/** The chunks a reply yielded, as the panel would have seen them. */
async function drained(reply: StreamedReply): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of reply) chunks.push(chunk);
  return chunks;
}
