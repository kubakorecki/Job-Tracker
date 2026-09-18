import type { JobApplication } from "@repo/schema";
import { redirect } from "next/navigation";
import { MONTHS_OFFERED } from "../../../lib/activity-report/month";
import type { Reportable } from "../../../lib/activity-report/report";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../../lib/auth/route-access";
import { listJobApplications } from "../../../lib/job-applications/repository";
import { statusChangesSince } from "../../../lib/status-changes/repository";
import { AppBar, Page, PageBody } from "../../app-bar";
import { ActivityReportPage } from "./activity-report";

/**
 * The Activity Report's page reads the record and hands it to the browser,
 * which is where the document is actually made.
 *
 * It reads rather than proposes because it cannot propose: a month's
 * boundaries are the reader's own zone, and a server renders in whatever zone
 * the host happens to run in (ADR-0012). So this is everything the report
 * could be made of, and the browser makes it — which is also what lets the
 * month selector change months without another round trip.
 */
export default async function ActivityReportRoute() {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns whose month to read.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  // Both reads through the repositories rather than through the endpoints:
  // this renders on the server, where an HTTP hop to itself would buy nothing.
  // The user's id is still the argument that scopes them (ADR-0001).
  const [jobApplications, statusChanges] = await Promise.all([
    listJobApplications(user.id),
    statusChangesSince(user.id, historyOpensAt(new Date())),
  ]);

  return (
    <Page>
      {/* No "Track a job" on the bar: that button opens a panel over the
          board, and this page is a document the user is in the middle of. */}
      <AppBar email={user.email ?? user.id} />
      <PageBody>
        <ActivityReportPage
          jobApplications={jobApplications.map(reportable)}
          statusChanges={statusChanges}
        />
      </PageBody>
    </Page>
  );
}

/**
 * As much of a Job Application as a row is made of, and no more.
 *
 * The whole list is read — there is one repository function and the board uses
 * it — but only these seven fields cross to the browser. The rest is a
 * Posting's description, its Requirements and their Coverage readings, which
 * for a couple of hundred Job Applications is a great deal of text to send to
 * a page that would not look at any of it.
 */
function reportable(jobApplication: JobApplication): Reportable {
  const {
    id,
    company,
    jobTitle,
    location,
    source,
    jobUrl,
    appliedAt,
    interviews,
  } = jobApplication;

  return {
    id,
    company,
    jobTitle,
    location,
    source,
    jobUrl,
    appliedAt,
    interviews,
  };
}

/**
 * How far back the page reads the history: well before the earliest month the
 * selector offers, rather than exactly at it.
 *
 * The slack is the zone. The months on offer are counted in the reader's zone,
 * which this render does not know, so a window cut to the month would lose a
 * day off the far end of the list for a reader east of UTC — and cutting two
 * months early costs two months of one user's Status Changes, which is
 * nothing.
 */
function historyOpensAt(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_OFFERED + 1), 1),
  );
}
