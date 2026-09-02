"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "../supabase/server";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "./route-access";
import { signInErrorMessage } from "./sign-in-error";

const Credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignInState = { error: string | null };

/**
 * Signs the user in against Supabase Auth. There is deliberately no matching
 * sign-up action: the single account is created by hand in the Supabase
 * dashboard (ADR-0001).
 */
export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const credentials = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    return { error: "Enter an email address and a password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);

  if (error !== null) {
    return {
      error: signInErrorMessage({ code: error.code, status: error.status }),
    };
  }

  redirect(DASHBOARD_PATH);
}

/** Ends the session and clears its cookies, then lands back on sign-in. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}
