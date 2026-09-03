import { createHash, randomBytes } from "node:crypto";

/**
 * The credential itself: how one is minted, how it is stored, and how it is
 * read off a request. Nothing here touches the database — the three are
 * together because they must agree, and they are the whole of what makes a
 * pasted string into an identity.
 */

/**
 * Marks a string as this application's credential, so one found in a config
 * file or a log is recognisable at a glance and by a secret scanner. It is not
 * a namespace: the random part alone is what has to be unguessable.
 */
const PREFIX = "jbt_";

/**
 * A new token. 32 bytes from the system's CSPRNG, which is far past what any
 * offline search could reach — the value is never derived from the user, the
 * name, or the time, so there is nothing to guess but the bytes.
 */
export function generatePersonalAccessToken(): string {
  return `${PREFIX}${randomBytes(32).toString("base64url")}`;
}

/**
 * The token's stored form. SHA-256 rather than a password hash on purpose:
 * this is a high-entropy random value, not a memorable secret, so there is no
 * dictionary to slow an attacker down through — and authentication looks a
 * token up by this exact string, which a per-row salt would make impossible.
 */
export function hashPersonalAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The token a request carries, or `null` for a request that carries none —
 * including one whose `Authorization` header is some other scheme, or a
 * `Bearer` with nothing after it. A request with no token is not refused here;
 * it simply has no token, and the session cookie gets its turn.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;

  const [scheme, ...rest] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;

  const token = rest.join(" ").trim();
  return token === "" ? null : token;
}
