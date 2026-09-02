import { signOut } from "../../lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium transition-colors hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
        type="submit"
      >
        Sign out
      </button>
    </form>
  );
}
