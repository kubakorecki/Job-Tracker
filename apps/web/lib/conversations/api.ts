import type { JobApplication, Message } from "@repo/schema";
import {
  AI_USAGE_LIMIT_STATUS,
  AI_USAGE_SPENT_MESSAGE,
  mayStartAiCall,
} from "../ai-usage/meter";
import { recordAiUsage } from "../ai-usage/repository";
import { jsonBody } from "../api/request";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import type { ConversationRow } from "../db/schema";
import { isJobApplicationId } from "../job-applications/api";
import { getJobApplication } from "../job-applications/repository";
import {
  MODEL_CALL_CEILING_MESSAGE,
  MODEL_CALL_LIMIT_STATUS,
  spendModelCall,
} from "../model-calls/budget";
import { describeIssues } from "../zod-issues";
import { ASSEMBLERS, type Assemblers } from "./assembly";
import { SaidMessage } from "./contract";
import {
  streamConversationWithGemini,
  type StreamConversation,
  type StreamedReply,
} from "./provider";
import {
  appendMessage,
  clearConversation,
  conversationFor,
  messagesIn,
} from "./repository";
import { streamedTurn } from "./stream";
import { messageFrom } from "./view";

/**
 * The Conversation endpoints: saying something, reading it back, and clearing
 * it.
 *
 * One address per scope rather than per Conversation, because a Conversation
 * is found by standing somewhere rather than picked off a list — there are two
 * kinds and no more, and the scope in the path is the whole of the routing
 * (`CONTEXT.md`). A client never holds a Conversation's id and never needs
 * one, which is also why there is no address that creates one.
 *
 * The provider and the two assemblers are substitutable, so every path through
 * a turn — a first one, a follow-up, a spent allowance, a provider that could
 * not be reached, a reply that broke off halfway — is exercisable with no API
 * key, no bucket and no network. Nothing but a test passes any of them.
 */

/** The scope in the path: a Job Application's id, or the general Conversation. */
export type ConversationParams = { scope: string };

/**
 * The one scope that is not an id. A literal rather than an empty segment or a
 * separate address, so that the three routes have one shape between them and a
 * client builds a URL the same way wherever the user is standing.
 */
export const GENERAL_SCOPE = "general";

/**
 * What the user is told when nothing of the reply arrived — an outage, an
 * exhausted quota, a model stopped by its own safety filter before a word.
 *
 * A different sentence from a spent allowance, which is the month ending
 * rather than a fault, and from a reply that broke off, which has prose to
 * show for itself (the spec's stories 22, 23 and 29).
 */
export const MODEL_UNREACHABLE_MESSAGE =
  "The model could not be reached, so nothing was said. Try again shortly.";

/**
 * `POST /api/conversations/:scope/messages`. One turn: the user says
 * something, and the reply is streamed back as it is written.
 *
 * The order is the one every model call in this product makes, with the
 * Conversation's own two writes threaded through it: resolve the scope, check
 * the month's AI Usage, spend the day's Model Call, persist what the user
 * said, assemble, stream, persist the reply, record what it cost. Everything
 * refused above the Model Call costs nothing at all, and the Model Call is
 * spent before the provider is reached so that a call which got there counts
 * whether or not it came back (ADR-0009).
 *
 * A refusal is an ordinary JSON error with a status, because it happens before
 * a byte of the reply exists. Once prose is arriving there is no status left
 * to answer with, which is why a reply that breaks off halfway is an event on
 * the stream rather than a code — and why the first piece of prose is waited
 * for before this answers at all.
 */
export function sendMessageResponse(
  stream: StreamConversation = streamConversationWithGemini,
  assemble: Assemblers = ASSEMBLERS,
) {
  return async (
    request: Request,
    user: CurrentUser,
    { scope }: ConversationParams,
  ): Promise<Response> => {
    const scoped = await resolveScope(user.id, scope);
    if (scoped === null) return notFound();

    const read = await jsonBody(request);
    if ("refusal" in read) return read.refusal;

    const said = SaidMessage.safeParse(read.body);
    if (!said.success) {
      return errorResponse(
        "That is not something that can be said.",
        400,
        describeIssues(said.error),
      );
    }

    // The month's AI Usage, asked before the turn starts and never again: a
    // reply cannot be priced until its last chunk has arrived, so a turn
    // admitted here is allowed to finish and overshoot (ADR-0009).
    if ((await mayStartAiCall(user.id)) === "over-limit") {
      return errorResponse(AI_USAGE_SPENT_MESSAGE, AI_USAGE_LIMIT_STATUS);
    }

    if ((await spendModelCall(user.id)) === "over-limit") {
      return errorResponse(MODEL_CALL_CEILING_MESSAGE, MODEL_CALL_LIMIT_STATUS);
    }

    // Found, or made because this is the first time the user has stood here —
    // and made below the two refusals above rather than beside the scope they
    // belong to, so that a turn nobody is allowed to take leaves nothing at
    // all behind it.
    const conversation = await conversationFor(
      user.id,
      scoped.jobApplication?.id ?? null,
    );

    // What was said before this turn, read before this turn's Message is
    // written. Reading after the write would hand the provider the just-said
    // Message as something already answered and again as the thing being
    // answered, and the model would be asked the same question twice.
    const priorMessages = await messagesIn(user.id, conversation.id);

    const asked = await appendMessage(user.id, conversation.id, {
      role: "user",
      text: said.data.text,
    });

    // Assembled from the state of this moment, after the user's Message is
    // safely down: a turn is a record of something said, and a question the
    // provider never answers is still a question the user asked.
    const instructions =
      scoped.jobApplication === null
        ? await assemble.general(user.id)
        : await assemble.attached(user.id, scoped.jobApplication);

    const reply = stream({
      instructions,
      priorMessages,
      said: said.data.text,
    });

    // The reply's first prose, waited for before a response exists. It is the
    // one thing that decides between the two failures the user has to tell
    // apart: nothing arrived and the model could not be reached, or something
    // did and the reply broke off with a paragraph worth keeping.
    const arrived = await firstProse(reply);
    if (arrived === null) {
      // Nothing was said, so there is no Message to keep — but a model stopped
      // by its own filter read the whole prompt and was billed for it, and the
      // meter counts what the provider reported either way (ADR-0009).
      await recordAiUsage(user.id, reply.soFar().tokens);
      return errorResponse(MODEL_UNREACHABLE_MESSAGE, 502);
    }

    return streamedTurn({
      userId: user.id,
      conversationId: conversation.id,
      asked,
      reply,
      arrived,
    });
  };
}

/**
 * `GET /api/conversations/:scope`. Everything said in this scope's
 * Conversation, oldest first, which is the only order a conversation can be
 * read back in.
 *
 * An empty array is the ordinary answer for a scope the user has not spoken in
 * yet rather than a 404 — the Conversation is there to be found, and a client
 * made to read "nothing said yet" out of a failure would handle the common
 * case in a catch block.
 *
 * A plain function rather than a factory, unlike the turn above: reading a
 * Conversation reaches no provider, so there is nothing here to substitute.
 */
export async function readConversationResponse(
  _request: Request,
  user: CurrentUser,
  { scope }: ConversationParams,
): Promise<Response> {
  const conversation = await conversationIn(user.id, scope);
  if (conversation === null) return notFound();

  const messages = await messagesIn(user.id, conversation.id);

  const said: Message[] = messages.map(messageFrom);
  return Response.json(said);
}

/**
 * `DELETE /api/conversations/:scope/messages`. Empties the Conversation and
 * keeps it.
 *
 * The Messages rather than the Conversation, because the two are different
 * acts: the user is abandoning a line of thinking and carrying on in the same
 * place, and the scope still has the one Conversation it is entitled to. There
 * is no archive — clearing destroys what it clears, which is what the panel
 * warns about before it asks for this (`CONTEXT.md`, the spec's story 18).
 *
 * Clearing an empty Conversation is a 204 like any other. The user asked for
 * nothing to be there and nothing is there; making the second press a failure
 * would be reporting a state they wanted.
 */
export async function clearConversationResponse(
  _request: Request,
  user: CurrentUser,
  { scope }: ConversationParams,
): Promise<Response> {
  const conversation = await conversationIn(user.id, scope);
  if (conversation === null) return notFound();

  await clearConversation(user.id, conversation.id);

  return new Response(null, { status: 204 });
}

/**
 * Which Conversation the path names: the general one, or the one attached to a
 * Job Application this user owns.
 *
 * The Job Application is read rather than merely checked, because the attached
 * assembler needs it and reading it twice would be a second query for a row
 * already in hand.
 */
type Scoped = { jobApplication: JobApplication | null };

async function resolveScope(
  userId: string,
  scope: string,
): Promise<Scoped | null> {
  if (scope === GENERAL_SCOPE) return { jobApplication: null };

  if (!isJobApplicationId(scope)) return null;

  const jobApplication = await getJobApplication(userId, scope);
  if (jobApplication === null) return null;

  return { jobApplication };
}

/**
 * This scope's Conversation, found or made, or `null` where the scope is not
 * this user's to stand in.
 *
 * The read and the clear go through here; the turn resolves the scope itself,
 * because it needs the Job Application to assemble from and would otherwise
 * read the same row twice.
 */
async function conversationIn(
  userId: string,
  scope: string,
): Promise<ConversationRow | null> {
  const scoped = await resolveScope(userId, scope);
  if (scoped === null) return null;

  return conversationFor(userId, scoped.jobApplication?.id ?? null);
}

/**
 * A scope that is not a word this API knows, and one naming a stranger's Job
 * Application, are the same answer — the shape the Tailored CV endpoints use,
 * so that the API never confirms a stranger's row is real. It is a
 * Conversation that is missing rather than the Job Application, because a
 * Conversation is what this address is for.
 */
function notFound(): Response {
  return errorResponse("No such Conversation.", 404);
}

/**
 * The reply as far as its first prose, or `null` where it had none to give.
 *
 * A provider that fails before a word is a different answer to the user from
 * one that stops halfway, and this is where the two part company: everything
 * after this point has prose to keep and a stream already open, and everything
 * refused before it is an ordinary status with an error in it.
 *
 * Prose rather than chunks, which is the provider's own rule read back: a
 * reply of nothing but whitespace is not a reply, so a stream that has sent
 * only blank chunks has said nothing yet and is waited on rather than
 * answered. What comes back is everything that has arrived and not merely the
 * chunk that settled it, so that what the panel draws adds up to exactly what
 * is written down.
 */
async function firstProse(reply: StreamedReply): Promise<string | null> {
  try {
    for (;;) {
      const next = await reply.next();
      if (next.done === true) return null;

      const arrived = reply.soFar().answer;
      if (arrived !== "") return arrived;
    }
  } catch {
    return null;
  }
}
