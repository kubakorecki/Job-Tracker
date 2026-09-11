import { CreateJobApplication, type Message } from "@repo/schema";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_USAGE_LIMIT_STATUS,
  AI_USAGE_SPENT_MESSAGE,
  MONTHLY_AI_USAGE_LIMIT,
} from "../ai-usage/meter";
import {
  aiUsageSoFar,
  forgetAiUsage,
  setAiUsage,
} from "../ai-usage/repository";
import { authenticatedRoute } from "../api/authenticated-route";
import type { CurrentUser } from "../auth/current-user";
import {
  createJobApplication,
  deleteJobApplication,
} from "../job-applications/repository";
import {
  DAILY_MODEL_CALL_LIMIT,
  MODEL_CALL_CEILING_MESSAGE,
  MODEL_CALL_LIMIT_STATUS,
} from "../model-calls/budget";
import { forgetModelCalls, setModelCallCount } from "../model-calls/repository";
import {
  bearer,
  forgetTestTokens,
} from "../test-support/personal-access-tokens";
import {
  forgetTestProfiles,
  giveProfileSkills,
} from "../test-support/profiles";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  clearConversationResponse,
  GENERAL_SCOPE,
  MODEL_UNREACHABLE_MESSAGE,
  readConversationResponse,
  sendMessageResponse,
  type ConversationParams,
} from "./api";
import type { Assemblers } from "./assembly";
import { ConversationEvent } from "./contract";
import {
  replyFrom,
  type ConversationTurn,
  type ReplyChunk,
  type StreamConversation,
} from "./provider";
import { conversationFor, deleteConversation } from "./repository";
import { REPLY_BROKE_OFF_MESSAGE } from "./stream";

/**
 * The three Conversation endpoints, exercised the way the rest of the backend
 * is: through the handler, against the dev Supabase project (ADR-0003),
 * asserting only what a client can see.
 *
 * No API key and no network. The provider is substituted at the function the
 * endpoints were built around, and a stand-in that keeps every turn it was
 * asked is how "the model was shown this Job Application, and the follow-up
 * carried what came before it" is proved without reaching one.
 *
 * The assemblers are left real unless a test is about them. What the prompt
 * says is `context.test.ts`'s business; what these tests want to know is that
 * the right one was asked, which the instructions the stand-in kept will say
 * plainly enough.
 */

const CONVERSATIONS = "https://job-tracker.test/api/conversations";

const conversationAt = (scope: string) => `${CONVERSATIONS}/${scope}`;
const messagesAt = (scope: string) => `${CONVERSATIONS}/${scope}/messages`;

/** The routes, assembled exactly as their `route.ts` assembles them. */
const conversations = {
  get: authenticatedRoute<ConversationParams>(readConversationResponse),
  delete: authenticatedRoute<ConversationParams>(clearConversationResponse),
};

/** What the Profile says, so the assemblers have a CV to put in the prompt. */
const CV_TEXT = "Jane Doe — Senior Engineer. TypeScript, React, Postgres.";
const SKILLS = ["TypeScript", "Postgres"];

/** The Posting's own prose, which only the attached Conversation may see. */
const DESCRIPTION =
  "We are hiring a platform engineer to look after our deployment pipeline.";

/** What the fake provider reports, in the cumulative way Gemini reports it. */
const PROMPT_TOKENS = 4_200;
const THINKING_TOKENS = 800;
const CHUNK_TOKENS = 60;

/** What a turn costs once the given number of prose chunks have arrived. */
const spent = (chunks: number) =>
  PROMPT_TOKENS + THINKING_TOKENS + chunks * CHUNK_TOKENS;

/** A reply in the two pieces it is streamed in. */
const FIRST_PIECE = "Dear hiring manager,\n\n";
const SECOND_PIECE = "I am writing about the platform engineer role.";
const REPLY = `${FIRST_PIECE}${SECOND_PIECE}`;

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

beforeEach(async () => {
  for (const user of [TEST_USER, OTHER_TEST_USER]) {
    await forgetModelCalls(user.id);
    await forgetAiUsage(user.id);
  }
  await forgetConversations();
  await giveProfileSkills(TEST_USER, SKILLS, CV_TEXT);
});

afterEach(async () => {
  // A Job Application takes its Conversation and that Conversation's Messages
  // with it, which is the cascade the schema promises.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
  await forgetConversations();
  await forgetTestProfiles(TEST_USER, OTHER_TEST_USER);
});

afterAll(forgetTestTokens);

/** The general Conversation is never cascaded away, so it is cleared by hand. */
async function forgetConversations(): Promise<void> {
  for (const user of [TEST_USER, OTHER_TEST_USER]) {
    const general = await conversationFor(user.id, null);
    await deleteConversation(user.id, general.id);
  }
}

/** A Job Application to stand on, taken away when the test is done. */
async function aJobApplication(
  user: CurrentUser = TEST_USER,
  company = "Vercel",
): Promise<string> {
  const created = await createJobApplication(
    user.id,
    CreateJobApplication.parse({
      company,
      jobTitle: "Platform Engineer",
      description: DESCRIPTION,
      requirements: [{ skill: "Kubernetes", necessity: "required" }],
    }),
  );

  saved.push({ userId: user.id, id: created.id });
  return created.id;
}

/**
 * A stand-in for the model that streams what the test says and keeps every
 * turn it was asked. An `Error` in the pieces is the stream failing at that
 * point — before the first word where it comes first, partway through where it
 * comes later.
 *
 * It is built on the provider's own reader rather than on a hand-rolled
 * generator, so what these tests exercise is the real rule about what `soFar`
 * holds when a stream breaks off. Only the network is faked.
 */
type FakeProvider = { stream: StreamConversation; turns: ConversationTurn[] };

function streaming(...pieces: (string | Error)[]): FakeProvider {
  const turns: ConversationTurn[] = [];

  return {
    turns,
    stream: (turn) => {
      turns.push(turn);
      return replyFrom(fed(pieces));
    },
  };
}

/** The chunks a provider would send, usage and all. */
async function* fed(
  pieces: (string | Error)[],
): AsyncGenerator<ReplyChunk, void> {
  let written = 0;

  for (const piece of pieces) {
    if (piece instanceof Error) throw piece;

    written += 1;
    yield { text: piece, usageMetadata: usage(written) };
  }

  // Gemini's last chunk carries the usage and no prose, which is what makes a
  // reply that said nothing at all still a reply that was billed for.
  yield { usageMetadata: usage(written) };
}

function usage(chunks: number) {
  return {
    promptTokenCount: PROMPT_TOKENS,
    candidatesTokenCount: chunks * CHUNK_TOKENS,
    thoughtsTokenCount: THINKING_TOKENS,
  };
}

/** Says something, with the model standing in as the caller says. */
async function say(
  user: CurrentUser,
  scope: string,
  provider: FakeProvider = streaming(FIRST_PIECE, SECOND_PIECE),
  body: unknown = { text: "Write me a covering letter." },
  assemblers?: Assemblers,
): Promise<Response> {
  return authenticatedRoute<ConversationParams>(
    sendMessageResponse(provider.stream, assemblers),
  )(
    new Request(messagesAt(scope), {
      method: "POST",
      headers: await bearer(user),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ scope }) },
  );
}

/** Everything one Conversation has in it, as a client reads it back. */
async function read(user: CurrentUser, scope: string): Promise<Response> {
  return conversations.get(
    new Request(conversationAt(scope), { headers: await bearer(user) }),
    { params: Promise.resolve({ scope }) },
  );
}

async function saidIn(user: CurrentUser, scope: string): Promise<Message[]> {
  const response = await read(user, scope);
  expect(response.status).toBe(200);
  return response.json();
}

/** Clears one Conversation, as the panel's confirmed press does. */
async function clear(user: CurrentUser, scope: string): Promise<Response> {
  return conversations.delete(
    new Request(messagesAt(scope), {
      method: "DELETE",
      headers: await bearer(user),
    }),
    { params: Promise.resolve({ scope }) },
  );
}

/**
 * The stream as the panel reads it, parsed through the contract — so a turn
 * that answered with something the panel could not read is a failing test
 * rather than a surprise in a browser.
 */
async function eventsOf(response: Response): Promise<ConversationEvent[]> {
  const body = await response.text();

  return body
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => ConversationEvent.parse(JSON.parse(line)));
}

/** What the model wrote, as the panel would have drawn it from the pieces. */
function drawn(events: ConversationEvent[]): string {
  return events
    .filter((event) => event.event === "wrote")
    .map((event) => event.text)
    .join("");
}

/** The one event a turn ends with. */
function ending(events: ConversationEvent[]): ConversationEvent {
  const last = events.at(-1);
  if (last === undefined) throw new Error("The turn sent no events at all.");
  return last;
}

/** An error body, as every endpoint here answers with one. */
async function refusal(response: Response): Promise<string> {
  const body: { error: string } = await response.json();
  return body.error;
}

describe("taking a turn", () => {
  it("answers the first thing said in a scope nobody has stood in", async () => {
    const provider = streaming(FIRST_PIECE, SECOND_PIECE);

    const response = await say(TEST_USER, GENERAL_SCOPE, provider);

    expect(response.status).toBe(200);
    const events = await eventsOf(response);
    expect(drawn(events)).toBe(REPLY);

    const said = await saidIn(TEST_USER, GENERAL_SCOPE);
    expect(said).toMatchObject([
      { role: "user", text: "Write me a covering letter.", incomplete: false },
      { role: "model", text: REPLY, incomplete: false },
    ]);
  });

  it("writes the user's Message down before the reply is asked for", async () => {
    const provider = streaming(FIRST_PIECE, SECOND_PIECE);

    const events = await eventsOf(
      await say(TEST_USER, GENERAL_SCOPE, provider),
    );

    // The panel draws what the user typed the moment they press send, and the
    // Message it reconciles that against is the row — ids, timestamp and all —
    // rather than one it assembles for itself.
    const [first] = events;
    expect(first).toMatchObject({
      event: "asked",
      message: { role: "user", text: "Write me a covering letter." },
    });
  });

  it("ends with the Message the reply was kept as", async () => {
    const events = await eventsOf(await say(TEST_USER, GENERAL_SCOPE));

    const last = ending(events);
    expect(last).toMatchObject({
      event: "finished",
      message: { role: "model", text: REPLY, incomplete: false },
    });

    // The same row a reload reads back, which is what keeps the panel's two
    // ways of knowing a Message from drifting apart.
    const said = await saidIn(TEST_USER, GENERAL_SCOPE);
    expect(last.event === "finished" && last.message.id).toBe(said[1]?.id);
  });

  it("carries what was said before into the next turn", async () => {
    const first = streaming(FIRST_PIECE, SECOND_PIECE);
    await eventsOf(await say(TEST_USER, GENERAL_SCOPE, first));

    const second = streaming("Shorter, then.");
    await eventsOf(
      await say(TEST_USER, GENERAL_SCOPE, second, {
        text: "Make it shorter.",
      }),
    );

    // What came before, in the order it was said — and the thing being
    // answered is the new Message rather than a repeat of it, which is the one
    // mistake the provider's own doc warns this caller about.
    const turn = second.turns[0];
    expect(turn?.priorMessages).toMatchObject([
      { role: "user", text: "Write me a covering letter." },
      { role: "model", text: REPLY },
    ]);
    expect(turn?.said).toBe("Make it shorter.");
  });

  it("shows an attached Conversation the Job Application it is about", async () => {
    const id = await aJobApplication();
    const provider = streaming("It suits you well.");

    await eventsOf(await say(TEST_USER, id, provider));

    const instructions = provider.turns[0]?.instructions ?? "";
    expect(instructions).toContain("Vercel");
    expect(instructions).toContain(DESCRIPTION);
    expect(instructions).toContain(CV_TEXT);
  });

  it("shows the general Conversation every Job Application and no Posting's prose", async () => {
    await aJobApplication(TEST_USER, "Vercel");
    const provider = streaming("Chase Vercel first.");

    await eventsOf(await say(TEST_USER, GENERAL_SCOPE, provider));

    const instructions = provider.turns[0]?.instructions ?? "";
    expect(instructions).toContain("Vercel");
    // The boundary ADR-0008 turns on, asserted here as well as in
    // `context.test.ts`, because this is where the wrong assembler would be
    // wired in.
    expect(instructions).not.toContain(DESCRIPTION);
  });

  it("takes its assemblers as arguments, and asks the one the scope names", async () => {
    const id = await aJobApplication();
    const asked: string[] = [];
    const assemblers: Assemblers = {
      attached: async (_userId, jobApplication) => {
        asked.push(`attached: ${jobApplication.company}`);
        return "Stand-in instructions.";
      },
      general: async () => {
        asked.push("general");
        return "Stand-in instructions.";
      },
    };

    const attached = streaming("Yes.");
    await eventsOf(
      await say(
        TEST_USER,
        id,
        attached,
        { text: "Is it worth it?" },
        assemblers,
      ),
    );
    const general = streaming("No.");
    await eventsOf(
      await say(
        TEST_USER,
        GENERAL_SCOPE,
        general,
        { text: "And overall?" },
        assemblers,
      ),
    );

    expect(asked).toEqual(["attached: Vercel", "general"]);
    expect(attached.turns[0]?.instructions).toBe("Stand-in instructions.");
  });

  it("records what the turn cost, thinking included", async () => {
    await eventsOf(await say(TEST_USER, GENERAL_SCOPE));

    expect(await aiUsageSoFar(TEST_USER.id)).toBe(spent(2));
  });

  it("keeps one user's Conversation out of another's", async () => {
    await eventsOf(await say(TEST_USER, GENERAL_SCOPE));

    expect(await saidIn(OTHER_TEST_USER, GENERAL_SCOPE)).toEqual([]);
  });

  it("never lets a client speak as the model", async () => {
    await eventsOf(
      await say(TEST_USER, GENERAL_SCOPE, streaming("Quite."), {
        text: "Say something.",
        role: "model",
      }),
    );

    const said = await saidIn(TEST_USER, GENERAL_SCOPE);
    expect(said[0]?.role).toBe("user");
  });

  it("refuses a Message with nothing in it", async () => {
    const provider = streaming(FIRST_PIECE);

    const response = await say(TEST_USER, GENERAL_SCOPE, provider, {
      text: "",
    });

    expect(response.status).toBe(400);
    expect(provider.turns).toEqual([]);
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toEqual([]);
  });

  it("refuses a body that is not JSON", async () => {
    const response = await authenticatedRoute<ConversationParams>(
      sendMessageResponse(streaming(FIRST_PIECE).stream),
    )(
      new Request(messagesAt(GENERAL_SCOPE), {
        method: "POST",
        headers: await bearer(TEST_USER),
        body: "not json",
      }),
      { params: Promise.resolve({ scope: GENERAL_SCOPE }) },
    );

    expect(response.status).toBe(400);
  });
});

describe("what a turn costs", () => {
  it("refuses a spent month before anything is persisted", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    const provider = streaming(FIRST_PIECE, SECOND_PIECE);

    const response = await say(TEST_USER, GENERAL_SCOPE, provider);

    expect(response.status).toBe(AI_USAGE_LIMIT_STATUS);
    expect(await refusal(response)).toBe(AI_USAGE_SPENT_MESSAGE);
    expect(provider.turns).toEqual([]);
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toEqual([]);
  });

  it("says the month is over rather than the day, when both are", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);

    const response = await say(TEST_USER, GENERAL_SCOPE);

    // The order is the refusal the user is meant to see: an allowance that
    // ended, rather than the precaution against a leaked token (ADR-0009).
    expect(await refusal(response)).toBe(AI_USAGE_SPENT_MESSAGE);
  });

  it("refuses once the day's Model Call ceiling is reached", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    const provider = streaming(FIRST_PIECE);

    const response = await say(TEST_USER, GENERAL_SCOPE, provider);

    expect(response.status).toBe(MODEL_CALL_LIMIT_STATUS);
    expect(await refusal(response)).toBe(MODEL_CALL_CEILING_MESSAGE);
    expect(provider.turns).toEqual([]);
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toEqual([]);
  });
});

describe("when the reply does not arrive", () => {
  it("answers that the model could not be reached, keeping the question", async () => {
    const provider = streaming(new Error("socket hung up"));

    const response = await say(TEST_USER, GENERAL_SCOPE, provider);

    expect(response.status).toBe(502);
    expect(await refusal(response)).toBe(MODEL_UNREACHABLE_MESSAGE);

    // What the user said stands — they said it — and there is no Message of
    // the model's, because the model said nothing.
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toMatchObject([
      { role: "user", text: "Write me a covering letter." },
    ]);
    // Nothing reached the provider, so nothing was billed (ADR-0009).
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(0);
  });

  it("treats a reply of nothing but whitespace as nothing said", async () => {
    // The provider's rule, read from this side: a Message of no words is a
    // blank turn in the panel, which the user reads as the product breaking
    // quietly. Nothing is written down, because nothing was said.
    const response = await say(
      TEST_USER,
      GENERAL_SCOPE,
      streaming("   ", "\n\n"),
    );

    expect(response.status).toBe(502);
    expect(await refusal(response)).toBe(MODEL_UNREACHABLE_MESSAGE);
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toMatchObject([
      { role: "user" },
    ]);
  });

  it("waits for prose rather than for a chunk, and keeps what led up to it", async () => {
    const response = await say(
      TEST_USER,
      GENERAL_SCOPE,
      streaming("\n\n", "Dear hiring manager,"),
    );

    // A reply that opened with a blank chunk is still a reply. What the panel
    // draws has to add up to what is written down, to the character.
    const events = await eventsOf(response);
    expect(drawn(events)).toBe("\n\nDear hiring manager,");
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toMatchObject([
      { role: "user" },
      { role: "model", text: "\n\nDear hiring manager,", incomplete: false },
    ]);
  });

  it("counts a reply that was paid for and never given", async () => {
    // A model stopped by its own safety filter: the stream runs to its end
    // having read the whole prompt and written nothing.
    const response = await say(TEST_USER, GENERAL_SCOPE, streaming());

    expect(response.status).toBe(502);
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(spent(0));
  });
});

describe("when the reply breaks off", () => {
  it("keeps what arrived and says it is not all of it", async () => {
    const provider = streaming(FIRST_PIECE, new Error("connection reset"));

    const response = await say(TEST_USER, GENERAL_SCOPE, provider);

    expect(response.status).toBe(200);
    const events = await eventsOf(response);
    expect(drawn(events)).toBe(FIRST_PIECE);
    expect(ending(events)).toMatchObject({
      event: "broke-off",
      error: REPLY_BROKE_OFF_MESSAGE,
      message: { role: "model", text: FIRST_PIECE, incomplete: true },
    });
  });

  it("leaves the partial reply in the Conversation, marked", async () => {
    await eventsOf(
      await say(
        TEST_USER,
        GENERAL_SCOPE,
        streaming(FIRST_PIECE, new Error("connection reset")),
      ),
    );

    // Reopening the panel tomorrow shows the same warning: a truncated reply
    // that lost its mark would read as the model's considered answer.
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toMatchObject([
      { role: "user" },
      { role: "model", text: FIRST_PIECE, incomplete: true },
    ]);
  });

  it("records what the broken stream was billed for", async () => {
    await eventsOf(
      await say(
        TEST_USER,
        GENERAL_SCOPE,
        streaming(FIRST_PIECE, new Error("connection reset")),
      ),
    );

    expect(await aiUsageSoFar(TEST_USER.id)).toBe(spent(1));
  });

  it("keeps what arrived when the reader goes away", async () => {
    const response = await say(
      TEST_USER,
      GENERAL_SCOPE,
      streaming(FIRST_PIECE, SECOND_PIECE),
    );

    // A browser that closed the panel mid-reply. The endpoint's own loop goes
    // down with it, and the paragraph that had arrived must not go with them.
    const reader = response.body?.getReader();
    if (reader === undefined)
      throw new Error("The turn answered with no body.");
    await reader.read();
    await reader.cancel();

    const said = await saidIn(TEST_USER, GENERAL_SCOPE);
    const reply = said[1];
    expect(reply?.role).toBe("model");
    expect(reply?.incomplete).toBe(true);
    expect(REPLY.startsWith(reply?.text ?? "")).toBe(true);
    expect(await aiUsageSoFar(TEST_USER.id)).toBeGreaterThan(0);
  });
});

describe("which Conversation the path names", () => {
  it("keeps a Job Application's Conversation apart from the general one", async () => {
    const id = await aJobApplication();

    await eventsOf(
      await say(TEST_USER, id, streaming("About this job."), {
        text: "About this job?",
      }),
    );
    await eventsOf(
      await say(TEST_USER, GENERAL_SCOPE, streaming("About all of them."), {
        text: "About all of them?",
      }),
    );

    expect(await saidIn(TEST_USER, id)).toMatchObject([
      { text: "About this job?" },
      { text: "About this job." },
    ]);
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toMatchObject([
      { text: "About all of them?" },
      { text: "About all of them." },
    ]);
  });

  it("is a 404 for a Job Application the user does not own", async () => {
    const theirs = await aJobApplication(OTHER_TEST_USER, "Someone else");
    const provider = streaming(FIRST_PIECE);

    const spoken = await say(TEST_USER, theirs, provider);
    expect(spoken.status).toBe(404);
    expect(await refusal(spoken)).toBe("No such Conversation.");

    expect((await read(TEST_USER, theirs)).status).toBe(404);
    expect((await clear(TEST_USER, theirs)).status).toBe(404);

    // Not a word of it reached the owner's Conversation either.
    expect(provider.turns).toEqual([]);
    expect(await saidIn(OTHER_TEST_USER, theirs)).toEqual([]);
  });

  it("is a 404 for a scope that is neither an id nor the general Conversation", async () => {
    const spoken = await say(TEST_USER, "everything", streaming(FIRST_PIECE));

    expect(spoken.status).toBe(404);
    expect((await read(TEST_USER, "everything")).status).toBe(404);
    expect((await clear(TEST_USER, "everything")).status).toBe(404);
  });
});

describe("reading a Conversation back", () => {
  it("answers an empty Conversation for a scope nothing has been said in", async () => {
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toEqual([]);
  });

  it("answers oldest first, over more than one turn", async () => {
    await eventsOf(
      await say(TEST_USER, GENERAL_SCOPE, streaming("First reply."), {
        text: "First question.",
      }),
    );
    await eventsOf(
      await say(TEST_USER, GENERAL_SCOPE, streaming("Second reply."), {
        text: "Second question.",
      }),
    );

    expect(
      (await saidIn(TEST_USER, GENERAL_SCOPE)).map(({ text }) => text),
    ).toEqual([
      "First question.",
      "First reply.",
      "Second question.",
      "Second reply.",
    ]);
  });
});

describe("clearing a Conversation", () => {
  it("empties it and keeps it", async () => {
    await eventsOf(await say(TEST_USER, GENERAL_SCOPE));
    const before = await conversationFor(TEST_USER.id, null);

    const response = await clear(TEST_USER, GENERAL_SCOPE);

    expect(response.status).toBe(204);
    expect(await saidIn(TEST_USER, GENERAL_SCOPE)).toEqual([]);
    // The same Conversation, still there to be carried on in: clearing is
    // abandoning a line of thinking, not leaving the room.
    expect((await conversationFor(TEST_USER.id, null)).id).toBe(before.id);
  });

  it("leaves the other Conversations alone", async () => {
    const id = await aJobApplication();
    await eventsOf(
      await say(TEST_USER, id, streaming("Kept."), { text: "Keep this." }),
    );
    await eventsOf(await say(TEST_USER, GENERAL_SCOPE));

    await clear(TEST_USER, GENERAL_SCOPE);

    expect(await saidIn(TEST_USER, id)).toMatchObject([
      { text: "Keep this." },
      { text: "Kept." },
    ]);
  });

  it("is a 204 for a Conversation with nothing in it", async () => {
    expect((await clear(TEST_USER, GENERAL_SCOPE)).status).toBe(204);
  });

  it("clears nobody else's", async () => {
    await eventsOf(await say(OTHER_TEST_USER, GENERAL_SCOPE));

    await clear(TEST_USER, GENERAL_SCOPE);

    expect(await saidIn(OTHER_TEST_USER, GENERAL_SCOPE)).toHaveLength(2);
  });
});
