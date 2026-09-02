import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · Job Tracker",
};

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Job Tracker</h1>
        <p className="text-sm opacity-60">Sign in to reach your board.</p>
      </div>

      <SignInForm />

      <p className="text-xs opacity-50">
        Accounts are created by hand in the Supabase dashboard — there is no
        sign-up.
      </p>
    </main>
  );
}
