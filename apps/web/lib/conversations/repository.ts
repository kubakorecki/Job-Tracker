import type { MessageRole } from "@repo/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import {
  conversations,
  messages,
  type ConversationRow,
  type MessageRow,
} from "../db/schema";

/**
 * Every read and write of a Conversation and its Messages. Like every other
 * repository module here, each function takes the owner's id as its first
 * argument and nothing else in the app builds a query, so tenant isolation
 * stays reviewable (ADR-0001).
 *
 * A Conversation is addressed by the scope the user is standing in rather than
 * picked off a list: a Job Application's id, or `null` for the general one.
 * There are two kinds and no more, and the pair of unique indexes on the table
 * is what says so — this module never has to check.
 *
 * Nothing here records what a Conversation was assembled against, or whether
 * it has gone stale. Each turn is built from the state of that moment, so a
 * Message is a record of something said rather than a claim still being made
 * (`CONTEXT.md`).
 */

/** What a Message carries when it is appended: who said it, and what. */
export type Said = { role: MessageRole; text: string };

/**
 * The Conversation for one scope, creating it if this is the first time the
 * user has stood there. `jobApplicationId` is the whole of the routing — an id
 * is that Job Application's Conversation, `null` is the general one.
 *
 * Creating on read rather than on some earlier event is what makes a
 * Conversation something a user finds rather than something they start: there
 * is nothing to name, nothing to pick, and no state in which a scope has no
 * Conversation to open.
 *
 * The insert leans on the unique indexes rather than on the read above it: two
 * requests arriving together would both find nothing, and the second's insert
 * is the one that does nothing and reads the first's row back.
 */
export async function conversationFor(
  userId: string,
  jobApplicationId: string | null,
): Promise<ConversationRow> {
  const found = await findConversation(userId, jobApplicationId);
  if (found !== null) return found;

  const [created] = await db()
    .insert(conversations)
    .values({ userId, jobApplicationId })
    .onConflictDoNothing()
    .returning();

  if (created !== undefined) return created;

  // Nothing came back, so somebody else's insert won the race. Their row is
  // this scope's Conversation as much as ours would have been.
  const raced = await findConversation(userId, jobApplicationId);
  if (raced === null) {
    throw new Error("The Conversation could neither be created nor found.");
  }

  return raced;
}

/**
 * What was said in one Conversation, oldest first, which is the only order a
 * conversation can be read back in.
 *
 * Scoped by owner as well as by Conversation, so a caller holding a stranger's
 * id is answered with an empty Conversation rather than with its contents
 * (ADR-0001).
 */
export async function messagesIn(
  userId: string,
  conversationId: string,
): Promise<MessageRow[]> {
  return db()
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        eq(messages.conversationId, conversationId),
      ),
    )
    .orderBy(asc(messages.saidAt));
}

/**
 * Adds one Message to a Conversation and answers with the row that was
 * written.
 *
 * A turn's two Messages are two calls, deliberately: the user's is persisted
 * before the provider is reached and the model's once the stream has ended, so
 * a reply that failed partway keeps the text that arrived. That is also what
 * keeps `said_at` an order — two inserts inside one transaction would share
 * the transaction's `now()` and be indistinguishable.
 *
 * The Conversation is looked up scoped by owner first, so a caller holding a
 * stranger's id writes nothing rather than adding to their Conversation.
 */
export async function appendMessage(
  userId: string,
  conversationId: string,
  { role, text }: Said,
): Promise<MessageRow> {
  const conversation = await getConversation(userId, conversationId);
  if (conversation === null) {
    throw new Error("There is no such Conversation to add a Message to.");
  }

  const [row] = await db()
    .insert(messages)
    .values({ userId, conversationId, role, text })
    .returning();

  if (row === undefined) {
    throw new Error("The insert returned no Message.");
  }

  return row;
}

/**
 * Empties a Conversation, keeping the Conversation itself.
 *
 * Distinct from `deleteConversation` below because they are different acts:
 * clearing is the user abandoning a line of thinking and carrying on in the
 * same place, which is why the row survives and the scope still has the one
 * Conversation it is entitled to. There is no archive — clearing destroys what
 * it clears (`CONTEXT.md`).
 */
export async function clearConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  await db()
    .delete(messages)
    .where(
      and(
        eq(messages.userId, userId),
        eq(messages.conversationId, conversationId),
      ),
    );
}

/**
 * Removes a Conversation and, by the Messages' cascade, everything said in it.
 * Answers whether there was one to remove.
 *
 * Nothing the user does reaches this: clearing is what they are offered, and a
 * deleted Job Application takes its Conversation with it by its own cascade.
 * It exists because the two acts are genuinely different and naming only one
 * of them would leave the other to be improvised at a call site — and because
 * a test that makes its own rows has to take them away again.
 */
export async function deleteConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const deleted = await db()
    .delete(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.id, conversationId),
      ),
    )
    .returning({ id: conversations.id });

  return deleted.length > 0;
}

/** One scope's Conversation, or `null` where the user has never stood there. */
async function findConversation(
  userId: string,
  jobApplicationId: string | null,
): Promise<ConversationRow | null> {
  const rows = await db()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        // Null is a scope rather than a missing value, and `= null` matches
        // nothing — so the general Conversation has to be asked for as the
        // absence it is.
        jobApplicationId === null
          ? isNull(conversations.jobApplicationId)
          : eq(conversations.jobApplicationId, jobApplicationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** One Conversation by id, scoped by owner; `null` for a stranger's. */
async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const rows = await db()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.id, conversationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
