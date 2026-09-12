// The schema itself rather than `job-applications/api.ts`'s
// `isJobApplicationId`, which asks the same question one import away from a
// repository. This module is read in the browser, and a panel that dragged the
// database client into the bundle to check the shape of a path would be paying
// for the wrong half of the app.
import { JobApplication } from "@repo/schema";
import { GENERAL_SCOPE } from "./contract";

/**
 * Which Conversation the user is standing in, read off the address and nothing
 * else.
 *
 * This is the whole of the routing. There are two kinds of Conversation and no
 * more, so there is no switcher and no picker anywhere in the UI — the panel
 * on a Job Application's page is that Job Application's Conversation, and the
 * panel everywhere else is the one general Conversation (`CONTEXT.md`).
 *
 * Which is why the scope is derived rather than held: a panel that remembered
 * which Conversation it was last showing could be showing one job's advice on
 * another job's page, and there would be nothing on screen to say so.
 */

/** Where the Job Application pages live, which is the one address that is not general. */
const JOB_APPLICATION_PATH = "/dashboard/job-applications";

/**
 * One Conversation, as the panel addresses it and as it introduces itself.
 *
 * The prose is here beside the scope rather than in the panel so that the
 * panel branches on the kind of Conversation nowhere at all: it draws whatever
 * this says, and adding a third kind would be adding a third of these rather
 * than a third arm to every conditional on screen.
 */
export type ConversationScope = {
  /** The segment the three endpoints are addressed by. */
  scope: string;
  /** What this Conversation is, in the header, so the scope is visible. */
  about: string;
  /**
   * What it can see, in one sentence.
   *
   * The general one's limit is said out loud rather than left to be inferred
   * from a vague answer: a Conversation that cannot quote a Posting should
   * read as bounded rather than as the model not paying attention (the spec's
   * story 15).
   */
  sees: string;
  /** What is worth asking it, where nothing has been asked yet. */
  invites: string;
};

const GENERAL: ConversationScope = {
  scope: GENERAL_SCOPE,
  about: "Your job search",
  sees: "It sees every Job Application in outline and your Profile — not any Posting's full description.",
  invites:
    "Ask which of these to chase this week, or what to write to somebody who has gone quiet.",
};

/**
 * The Conversation for a path.
 *
 * Anything at or below a Job Application's own page is that Job Application's;
 * everywhere else is the general one. Below as well as at, because nothing
 * sits under one today and a panel that fell back to the general Conversation
 * the first time something did would move the user's chat out from under them.
 *
 * An id that could not be one is the general Conversation rather than a scope
 * of its own. That address is a 404 on the page as well, and a panel that
 * addressed it anyway would be asking the API about a Job Application which
 * cannot exist.
 */
export function standingAt(pathname: string): ConversationScope {
  if (!pathname.startsWith(`${JOB_APPLICATION_PATH}/`)) return GENERAL;

  const id =
    pathname.slice(JOB_APPLICATION_PATH.length + 1).split("/")[0] ?? "";
  if (!JobApplication.shape.id.safeParse(id).success) return GENERAL;

  return {
    scope: id,
    about: "This Job Application",
    sees: "It sees this Job Application in full — the Posting, its Requirements and your Analysis — alongside your Profile.",
    invites:
      "Ask for a covering letter, or what the gaps in your Coverage really amount to.",
  };
}
