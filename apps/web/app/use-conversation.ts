"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeFailure } from "../lib/api/client";
import {
  clearMessages,
  fetchConversation,
  takeTurn,
} from "../lib/conversations/client";
import {
  NOTHING_SAID,
  afterEvent,
  asking,
  loaded,
  refused,
  type ConversationState,
} from "../lib/conversations/turn";

/**
 * One Conversation, as the panel holds it: what has been said, what is being
 * said, and what to tell the user when a turn does not happen.
 *
 * It is deliberately not a react-query hook. The panel stands on every
 * signed-in page and the query cache stops at `/dashboard` — a Conversation
 * that could only be opened where a `QueryProvider` happens to be is a panel
 * that is not on every page. There is nothing to share with the board in any
 * case: one Conversation is read by one panel, and a turn is a stream rather
 * than a request with a cacheable answer.
 *
 * Nothing is read until the panel is first opened. Most pages are not opened
 * to ask a question, and a Conversation fetched on every page load would be a
 * request nobody asked for.
 */

/** Whether this Conversation has been read back yet, and how that went. */
type Reading = "reading" | "read" | "failed";

export type Conversation = {
  said: ConversationState;
  /** Whether there is a CV on the Profile for this Conversation to have read. */
  cvAttached: boolean;
  reading: Reading;
  /** Why it could not be read back, in the endpoint's own words. */
  readFailure: string[];
  /** Whether a turn is in flight, so nothing offers to start a second. */
  taking: boolean;
  /** Reads it back again, after a read that failed. */
  retry: () => void;
  /** Takes a turn, and says whether what the user said was written down. */
  say: (text: string) => Promise<boolean>;
  /**
   * Destroys the Messages and keeps the Conversation, answering with what went
   * wrong where anything did.
   *
   * Handed back rather than pushed into `said.refusal`: a clear that failed is
   * not a turn that did not happen, and reporting it under the refusal's
   * heading would tell the user nothing was said when the thing that did not
   * happen was the deleting.
   */
  clear: () => Promise<string[]>;
};

/**
 * One scope's Conversation. The caller is expected to mount this per scope —
 * `ConversationPanel` keys on it — so nothing here has to unpick one
 * Conversation's state to make room for the next.
 */
export function useConversation(
  scope: string,
  /** Whether the panel is open. Nothing is read until it is. */
  open: boolean,
): Conversation {
  const [said, setSaid] = useState<ConversationState>(NOTHING_SAID);
  // Assumed until a read says otherwise, so a panel opening for a user who has
  // uploaded a CV never flashes a notice saying they have not.
  const [cvAttached, setCvAttached] = useState(true);
  // It opens onto a read rather than onto nothing: the panel is opened to be
  // used, and there is no state between "not asked for yet" and "on its way"
  // that anybody could see the difference between.
  const [reading, setReading] = useState<Reading>("reading");
  const [readFailure, setReadFailure] = useState<string[]>([]);
  const [taking, setTaking] = useState(false);

  // Which read is the current one, so a second attempt after a failure cannot
  // have the first one's answer land on top of it.
  const latest = useRef(0);

  /** Whether the read has been asked for, so opening twice does not ask twice. */
  const asked = useRef(false);

  /**
   * Opening the Conversation: everything said, and whether a CV is behind it.
   *
   * Nothing is set before the request goes out. The effect below calls this,
   * and a `setState` run synchronously inside an effect is a cascading render
   * — so the only state this touches is what the answer decides, and the
   * waiting state is where this hook starts.
   */
  const read = useCallback(async () => {
    const mine = (latest.current += 1);

    try {
      const view = await fetchConversation(scope);
      if (mine !== latest.current) return;

      setSaid(loaded(view.messages));
      setCvAttached(view.cvAttached);
      setReading("read");
    } catch (error) {
      if (mine !== latest.current) return;

      setReadFailure(describeFailure(error));
      setReading("failed");
    }
  }, [scope]);

  /** The first opening. Nothing is read until the user asks for the panel. */
  useEffect(() => {
    if (!open || asked.current) return;

    asked.current = true;
    void read();
  }, [open, read]);

  /**
   * The Conversation as the endpoint has it, after a turn that ended badly.
   *
   * It leaves the reading alone, unlike `read` above: the panel already has
   * Messages on screen and a sentence saying what went wrong, and a failed
   * second request has nothing to add to either.
   *
   * The failure is said once. Where the reply broke off partway, the endpoint
   * kept it as an incomplete Message and the panel shows the failure against
   * that text; a sentence in the footer saying it again would be one event
   * reported twice.
   */
  const reread = useCallback(
    async (problems: string[]) => {
      const mine = (latest.current += 1);

      try {
        const view = await fetchConversation(scope);
        if (mine !== latest.current) return;

        const stored = loaded(view.messages);
        setSaid(
          view.messages.at(-1)?.incomplete === true
            ? stored
            : refused(stored, problems),
        );
        setCvAttached(view.cvAttached);
      } catch {
        // What is on screen is what was said up to the failure already shown.
      }
    },
    [scope],
  );

  const say = useCallback(
    async (text: string): Promise<boolean> => {
      setTaking(true);
      setSaid((current) => asking(current, text));

      // Whether the endpoint wrote the user's words down. Everything refused
      // above the stream persists nothing at all, so the panel has to hand the
      // words back rather than leave them looking sent.
      let written = false;

      try {
        for await (const event of takeTurn(scope, text)) {
          written ||= event.event === "asked";
          setSaid((current) => afterEvent(current, event));
        }

        return true;
      } catch (error) {
        const problems = describeFailure(error);
        setSaid((current) => refused(current, problems));

        // A turn that had begun has already been written down by the endpoint,
        // half a paragraph and all, so the panel reads it back rather than
        // keeping its own copy of what arrived (the spec's story 23).
        if (written) await reread(problems);

        return written;
      } finally {
        setTaking(false);
      }
    },
    [scope, reread],
  );

  const clear = useCallback(async (): Promise<string[]> => {
    try {
      await clearMessages(scope);
      // Nothing is kept: there is no archive, which is what the panel warned
      // about before it asked for this.
      setSaid(NOTHING_SAID);
      return [];
    } catch (error) {
      // What was said is left exactly where it was. A clear that did not
      // happen has changed nothing, and a panel that emptied itself anyway
      // would be showing a Conversation the server still has.
      return describeFailure(error);
    }
  }, [scope]);

  return {
    said,
    cvAttached,
    reading,
    readFailure,
    taking,
    retry: () => {
      setReading("reading");
      void read();
    },
    say,
    clear,
  };
}
