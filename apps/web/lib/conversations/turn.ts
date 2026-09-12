import type { Message } from "@repo/schema";
import type { ConversationEvent } from "./contract";

/**
 * What the panel is showing, as one turn happens to it.
 *
 * It is written as pure transitions rather than inside the component for the
 * two things that are hard to watch in a browser and easy to get wrong: a
 * reply has to stream into one growing Message rather than pile up a Message
 * per chunk, and the words the user typed have to be drawn exactly once
 * whether the turn is written down, streamed or refused.
 *
 * Everything it holds beyond `messages` is provisional — the words on their
 * way to the server, and the reply on its way back. The moment either becomes
 * a row, the row replaces it: the panel never keeps a second copy of something
 * the endpoint has written down, because two copies of a Message are two
 * things that can disagree about what was said.
 */

export type ConversationState = {
  /** Everything written down, oldest first, as the server has it. */
  messages: Message[];
  /**
   * What the user has just said, before the endpoint has written it down.
   *
   * Drawn so that pressing send does something visible, and dropped the moment
   * the `asked` event brings back the row — the same words twice on screen
   * would read as the question having been asked twice.
   */
  pending: string | null;
  /** The reply as far as it has arrived, before it is a Message. */
  writing: string | null;
  /**
   * Why the last turn did not happen, in the endpoint's own words. A spent
   * allowance, a model that could not be reached and a reply that broke off
   * read differently, and none of them is the panel's sentence to write.
   */
  refusal: string[];
};

/**
 * A Conversation nobody has said anything in yet — and, because clearing
 * destroys what it clears and leaves no archive behind it, what one looks like
 * afterwards too.
 */
export const NOTHING_SAID: ConversationState = {
  messages: [],
  pending: null,
  writing: null,
  refusal: [],
};

/**
 * The Conversation as it was read back. Everything provisional goes with it:
 * what the server has is now the whole account of what was said, including a
 * reply that broke off, which it kept as an incomplete Message.
 */
export function loaded(messages: Message[]): ConversationState {
  return { ...NOTHING_SAID, messages };
}

/** The user has said something and it is on its way. */
export function asking(
  state: ConversationState,
  text: string,
): ConversationState {
  // The refusal goes now rather than when the turn succeeds: the user is
  // having another go, and a sentence about the last attempt sitting under the
  // one they are waiting on would read as a fresh failure.
  return { ...state, pending: text, writing: null, refusal: [] };
}

/** One event off the stream, applied. */
export function afterEvent(
  state: ConversationState,
  event: ConversationEvent,
): ConversationState {
  switch (event.event) {
    case "asked":
      return {
        ...state,
        messages: [...state.messages, event.message],
        pending: null,
      };

    case "wrote":
      return { ...state, writing: (state.writing ?? "") + event.text };

    // Both endings carry the row the endpoint kept, incomplete and all, so
    // what the panel shows the moment a reply lands and what it reads back
    // tomorrow are the same object rather than two renderings of one.
    case "finished":
    case "broke-off":
      return {
        ...state,
        messages: [...state.messages, event.message],
        writing: null,
      };
  }
}

/**
 * The turn did not happen, or stopped being watchable, and here is what to
 * tell the user.
 *
 * Both provisional halves go. A refused turn persists nothing at all, so the
 * question has to stop being shown as asked; and a turn that broke off mid-way
 * has already been written down by the endpoint, incomplete, so the panel
 * re-reads the Conversation rather than keeping its own half of the paragraph
 * beside the stored one.
 */
export function refused(
  state: ConversationState,
  problems: string[],
): ConversationState {
  return { ...state, pending: null, writing: null, refusal: problems };
}
