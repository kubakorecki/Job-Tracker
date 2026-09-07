"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "../../lib/auth/actions";
import { FIELD_TALL, LABEL, PRIMARY_BUTTON_TALL } from "../form";

const INITIAL: SignInState = { error: null };

/**
 * The door itself. Two boxes and a button, at the sign-in page's own height —
 * the one form in the app with nothing else on the page to be in proportion
 * to.
 *
 * A failed sign-in is reported plainly and nowhere near the app's dry voice.
 * It is the one thing on this page that can go wrong, and a joke over a
 * password somebody has just mistyped for the third time is the exact moment
 * the wit stops being funny.
 */
export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-[15px]">
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Email</span>
        <input
          autoComplete="email"
          className={FIELD_TALL}
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Password</span>
        <input
          autoComplete="current-password"
          className={FIELD_TALL}
          name="password"
          required
          type="password"
        />
      </label>

      {state.error !== null && (
        <p
          className="rounded-control border border-rose bg-rose-tint px-3 py-2.5 text-[12.5px] leading-[1.5] text-rose"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <button className={PRIMARY_BUTTON_TALL} disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
