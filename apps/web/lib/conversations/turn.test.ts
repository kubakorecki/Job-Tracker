import type { Message } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  NOTHING_SAID,
  afterEvent,
  asking,
  loaded,
  refused,
  type ConversationState,
} from "./turn";

/**
 * What the panel is showing, one turn at a time.
 *
 * It is a pure function of what has happened so far because the two things
 * worth proving here are hard to see through a browser and easy to get wrong:
 * that a reply streams into one growing Message rather than a Message per
 * chunk, and that the text the user typed is drawn exactly once whether the
 * turn is accepted, streamed or refused.
 */

const said = (text: string, over: Partial<Message> = {}): Message => ({
  id: `${text}-id`,
  conversationId: "conversation-id",
  role: "user",
  text,
  incomplete: false,
  saidAt: "2026-09-12T09:00:00.000Z",
  ...over,
});

const ASKED = said("Write me a covering letter.");
const REPLIED = said("Dear hiring manager, I am writing…", {
  id: "reply-id",
  role: "model",
});

/** A turn as far as the reply's first piece. */
const midTurn = (): ConversationState =>
  afterEvent(
    afterEvent(asking(NOTHING_SAID, ASKED.text), {
      event: "asked",
      message: ASKED,
    }),
    { event: "wrote", text: "Dear hiring manager, " },
  );

describe("what has been said already", () => {
  it("is what was read back", () => {
    expect(loaded([ASKED, REPLIED])).toEqual({
      ...NOTHING_SAID,
      messages: [ASKED, REPLIED],
    });
  });

  it("drops a refusal from the turn before it", () => {
    const after = loaded([ASKED, REPLIED]);

    expect(refused(after, ["Nothing doing."]).refusal).toEqual([
      "Nothing doing.",
    ]);
    expect(loaded([ASKED, REPLIED]).refusal).toEqual([]);
  });
});

describe("taking a turn", () => {
  it("shows what the user said before the server has it", () => {
    expect(asking(NOTHING_SAID, "Write me a covering letter.")).toMatchObject({
      pending: "Write me a covering letter.",
      messages: [],
    });
  });

  it("clears a refusal the user is having another go at", () => {
    const again = asking(refused(NOTHING_SAID, ["Nothing doing."]), "Again?");

    expect(again.refusal).toEqual([]);
  });

  it("draws the user's words once when the server writes them down", () => {
    const written = afterEvent(asking(NOTHING_SAID, ASKED.text), {
      event: "asked",
      message: ASKED,
    });

    expect(written.pending).toBeNull();
    expect(written.messages).toEqual([ASKED]);
  });

  it("streams the reply into one Message rather than one per chunk", () => {
    const writing = afterEvent(midTurn(), {
      event: "wrote",
      text: "I am writing…",
    });

    expect(writing.writing).toBe("Dear hiring manager, I am writing…");
    expect(writing.messages).toEqual([ASKED]);
  });

  it("keeps the reply as the Message the server wrote down", () => {
    const finished = afterEvent(midTurn(), {
      event: "finished",
      message: REPLIED,
    });

    // The row rather than the pieces the panel drew, so that what it shows
    // now and what it reads back tomorrow are the same thing.
    expect(finished.messages).toEqual([ASKED, REPLIED]);
    expect(finished.writing).toBeNull();
  });
});

describe("when a turn ends badly", () => {
  it("keeps a broken-off reply as the incomplete Message it is", () => {
    const brokeOff = said("Dear hiring manager,", {
      id: "partial-id",
      role: "model",
      incomplete: true,
    });

    const after = afterEvent(midTurn(), {
      event: "broke-off",
      message: brokeOff,
      error: "It broke off.",
    });

    expect(after.messages).toEqual([ASKED, brokeOff]);
    expect(after.writing).toBeNull();
  });

  it("takes back the words nobody wrote down, and says why", () => {
    // A refused turn persists nothing, so the panel must stop showing a
    // question that was never asked — and hand the words back to be sent again.
    const after = refused(asking(loaded([ASKED, REPLIED]), "Another?"), [
      "You have spent this month's AI Usage.",
    ]);

    expect(after.pending).toBeNull();
    expect(after.writing).toBeNull();
    expect(after.messages).toEqual([ASKED, REPLIED]);
    expect(after.refusal).toEqual(["You have spent this month's AI Usage."]);
  });

  it("gives up a half-written reply rather than keeping two copies of it", () => {
    // What arrived is already written down by the endpoint, incomplete and
    // all. The panel re-reads the Conversation instead of keeping its own
    // copy, so there is one account of what was said.
    expect(refused(midTurn(), ["It broke off."]).writing).toBeNull();
  });
});
