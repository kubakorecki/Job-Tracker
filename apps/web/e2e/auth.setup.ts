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
  await expect(
    page.getByRole("heading", { name: "Job Tracker" }),
  ).toBeVisible();

  await page.context().storageState({ path: SESSION_FILE });
});
