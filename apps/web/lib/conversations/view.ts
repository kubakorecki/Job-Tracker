import type { Message } from "@repo/schema";
import type { MessageRow } from "../db/schema";

/**
 * A Message as anything outside the database sees one.
 *
 * One conversion, used by the read and by both of the stream's endings, so
 * that a Message the panel draws mid-turn and the same Message read back
 * tomorrow are the same shape down to the field.
 */
export function messageFrom(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    text: row.text,
    incomplete: row.incomplete,
    saidAt: row.saidAt.toISOString(),
  };
}
