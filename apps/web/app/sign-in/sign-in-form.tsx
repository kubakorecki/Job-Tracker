"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "../../lib/auth/actions";

const INITIAL: SignInState = { error: null };

const FIELD_CLASS =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-500";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          autoComplete="email"
          className={FIELD_CLASS}
          name="email"
          required
          type="email"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Password</span>
        <input
          autoComplete="current-password"
          className={FIELD_CLASS}
          name="password"
          required
          type="password"
        />
      </label>

      {state.error !== null && (
        <p
          className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <button
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
