import type { JobApplication } from "@repo/schema";
import { expect, test } from "@playwright/test";

/**
 * The end-to-end tests. They exist to prove the dashboard, the API, the
 * database and browser storage are wired together at all — the API tests and
 * the `lib` unit tests carry the behavioural coverage, and adding cases here
 * would only make this slow and brittle.
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

  // The form is opened from the bar rather than standing under it: recording a
  // job by hand is the rarer of the two ways one arrives, and the board is what
  // the user came for. Scoped to the bar because a board with nothing on it
  // offers the same invitation in its empty state, and this test would take
  // either without saying which it meant.
  //
  // By the element rather than the `banner` role: the bar is drawn inside the
  // page's `<main>`, so its `<header>` is not a landmark, which is a fact
  // about the page rather than about this test.
  await page
    .locator("header")
    .getByRole("button", { name: "Track a job" })
    .click();

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

test("a sort chosen on the table outlives a reload", async ({
  page,
  request,
}) => {
  const run = Date.now();
  // Created oldest first, so newest added — the order with no sort — puts
  // Zulu above Alpha, and sorting A to Z has something to move.
  const alpha = `${COMPANY_PREFIX} ${run} Alpha`;
  const zulu = `${COMPANY_PREFIX} ${run} Zulu`;
  for (const company of [alpha, zulu]) {
    const created = await request.post("/api/job-applications", {
      data: { company, jobTitle: "Staff Engineer" },
    });
    expect(created.ok()).toBe(true);
  }

  // Just the rows this test made, in the order the table draws them.
  const companies = () =>
    page
      .getByRole("row")
      .getByRole("link", { name: `${COMPANY_PREFIX} ${run}` })
      .allTextContents();

  await page.goto("/dashboard");
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Table" })
    .click();
  await expect.poll(companies).toEqual([zulu, alpha]);

  await page.getByRole("button", { name: "Sort by Company, A to Z" }).click();
  await expect.poll(companies).toEqual([alpha, zulu]);

  // Nothing of the sort is in the URL or the database, so it can only still
  // be applied if browser storage is where it came back from.
  await page.reload();
  await expect(
    page.getByRole("columnheader", { name: "Sort by Company, Z to A" }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(companies).toEqual([alpha, zulu]);
});
