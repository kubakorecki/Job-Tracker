import { send } from "../api/client";
import type {
  CreatePersonalAccessToken,
  IssuedPersonalAccessToken,
  PersonalAccessToken,
} from "./contract";

/**
 * The Personal Access Token endpoints, as the settings page addresses them.
 * There is no list here: the page reads the tokens on the server and asks for
 * them again after a change, so there is no second copy to disagree with it.
 */

const ENDPOINT = "/api/personal-access-tokens";

/**
 * Issues a token. The response carries the raw value, and is the only time it
 * exists outside the user's clipboard — a caller that drops it cannot get it
 * back.
 */
export async function postPersonalAccessToken(
  input: CreatePersonalAccessToken,
): Promise<IssuedPersonalAccessToken> {
  return send(ENDPOINT, { method: "POST", body: input });
}

/** Revokes a token. It stops working at once; the row stays as its trace. */
export async function revokePersonalAccessToken(
  id: string,
): Promise<PersonalAccessToken> {
  return send(`${ENDPOINT}/${id}`, { method: "DELETE" });
}
