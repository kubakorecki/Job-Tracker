import { expect, test as setup } from "@playwright/test";
import { SESSION_FILE } from "../playwright.config";
import { e2eCredentials } from "./env";

/**
 * Signs in once per run, through the form a person would use, and saves the
 * session for the test that follows. Doing it through the form rather than by
 * minting a token is what proves sign-in itself still works — the smoke test
 * would otherwise start from a session no user could have obtained.
 */
setup("sign in as the end-to-end user", async ({ page }) => {
  const { email, password } = e2eCredentials();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The dashboard is only reachable with a session, so arriving here is the
  // assertion that one exists.
  await page.waitForURL("**/dashboard");

  // And that the signed-in shell actually rendered, rather than the URL
  // changing in front of a page that threw. It waits on the way out of the app
  // rather than on anything the board draws: the bar is the one thing on every
  // signed-in page, and "Sign out" is only ever on screen for somebody who is
  // signed in. A board with no Job Applications on it yet draws no tally, no
  // toolbar and no cards, and a setup that waited for those would fail for the
  // one user whose board is deliberately empty.
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.context().storageState({ path: SESSION_FILE });
});
