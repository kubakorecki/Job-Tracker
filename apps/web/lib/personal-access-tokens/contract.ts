import { z } from "zod";

/**
 * What a Personal Access Token looks like to a client. It lives here rather
 * than in `@repo/schema` because it is not a shared contract: the extension
 * only ever holds the raw string a user pasted into it, and the dashboard is
 * the only surface that issues, lists or revokes one.
 *
 * There is deliberately no hash in this shape. The hash is the credential's
 * stored form and nothing outside the database has any use for it, so the
 * type the endpoints answer with cannot carry it even by accident.
 */
export const PersonalAccessToken = z.object({
  id: z.uuid(),
  /** How the user tells one machine's token from another's. */
  name: z.string().min(1),
  createdAt: z.iso.datetime(),
  /** Null until the token is first used to reach the API. */
  lastUsedAt: z.iso.datetime().nullable(),
  /** Null while the token still works. Revocation is soft and permanent. */
  revokedAt: z.iso.datetime().nullable(),
});
export type PersonalAccessToken = z.infer<typeof PersonalAccessToken>;

/** Issuing a token asks for a name, and nothing else. */
export const CreatePersonalAccessToken = PersonalAccessToken.pick({
  name: true,
});
export type CreatePersonalAccessToken = z.infer<
  typeof CreatePersonalAccessToken
>;

/**
 * A token as it is answered once, at the moment it is issued: the row, plus
 * the raw value. Only this response ever carries `token` — the value is
 * hashed on the way into the database and cannot be recovered from it.
 */
export type IssuedPersonalAccessToken = PersonalAccessToken & {
  token: string;
};
