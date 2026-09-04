import type { JobApplication } from "@repo/schema";
import { expect, test } from "@playwright/test";

/**
 * The one end-to-end test. It exists to prove the dashboard, the API and the
 * database are wired together at all — the API tests carry the behavioural
 * coverage, and adding cases here would only make this slow and brittle.
 *
 * It needs the dev Supabase project awake (ADR-0003) and a dev server it can
 * reach; both are the config's business.
 */

/**
 * Every Job Application this test makes is named from here, so the cleanup can
 * find its own leavings — including ones a previous run failed halfway through
 * and left behind. The end-to-end user has no others.
 */
const COMPANY_PREFIX = "Playwright Smoke";

test.afterEach(async ({ request }) => {
  // Through the API rather than the UI: cleanup has to work after a test that
  // failed before it ever reached the delete button.
  const listed = await request.get("/api/job-applications");
  expect(listed.ok()).toBe(true);

  const jobApplications: JobApplication[] = await listed.json();
  const mine = jobApplications.filter(({ company }) =>
    company.startsWith(COMPANY_PREFIX),
  );

  // Every delete is attempted before any of them is complained about, or one
  // refusal would leave the rest of the run's rows behind — which is the one
  // thing this hook exists to prevent.
  const refused: string[] = [];
  for (const { id } of mine) {
    const deleted = await request.delete(`/api/job-applications/${id}`);
    if (!deleted.ok()) refused.push(`${id}: ${deleted.status()}`);
  }

  expect(refused).toEqual([]);
});

test("a Job Application added by hand keeps the Status it was moved to", async ({
  page,
}) => {
  const company = `${COMPANY_PREFIX} ${Date.now()}`;

  await page.goto("/dashboard");

  const addForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Add Job Application" }) });
  await addForm.getByLabel("Company").fill(company);
  await addForm.getByLabel("Job title").fill("Staff Engineer");
  await addForm.getByRole("button", { name: "Add Job Application" }).click();

  // A new Job Application starts Bookmarked, so the card lands in that column.
  await expect(
    page.getByRole("region", { name: "Bookmarked" }).getByText(company),
  ).toBeVisible();

  // Change its Status where every field of a Job Application is edited.
  await page.getByRole("link", { name: company }).click();
  await page.waitForURL("**/dashboard/job-applications/**");
  await page.getByLabel("Status").selectOption("interviewing");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Loading the board afresh is the assertion: none of the change is left in
  // the browser, so the card can only be under Interviewing if the database is
  // where it came back from.
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Interviewing" }).getByText(company),
  ).toBeVisible();
});
