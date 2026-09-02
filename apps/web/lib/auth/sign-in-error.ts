/**
 * The part of a Supabase auth error this app reacts to. Narrower than
 * `AuthError` on purpose: the message is chosen from the code, never passed
 * through, so the user never reads GoTrue's wording.
 */
export type SignInFailure = {
  code: string | undefined;
  status: number | undefined;
};

const RATE_LIMITED = "Too many sign-in attempts. Wait a minute and try again.";

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: "That email and password don't match an account.",
  email_not_confirmed:
    "This account's email address hasn't been confirmed yet.",
  over_request_rate_limit: RATE_LIMITED,
  over_email_send_rate_limit: RATE_LIMITED,
};

/**
 * Turns a failed sign-in into something worth reading. Bad credentials say so
 * plainly; anything we don't recognise blames the service rather than the
 * user, because a 500 is not the user's typing.
 */
export function signInErrorMessage({ code, status }: SignInFailure): string {
  const byCode = code === undefined ? undefined : MESSAGES_BY_CODE[code];
  if (byCode !== undefined) return byCode;
  if (status === 429) return RATE_LIMITED;
  return "Couldn't sign in right now. Try again in a moment.";
}
