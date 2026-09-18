import type { Interview, JobStatus, StatusChange } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  activityReportFor,
  MONTHLY_MINIMUM,
  shortOfContacts,
  type Reportable,
} from "./report";

/**
 * A month, proposed from what the record holds. Every case names the month it
 * is about and the zone it is counted in, and nothing here reads the clock —
 * a report is a document about a month that has finished, and a test that
 * asked what month it was would pass in September and fail in October.
 */

const SEPTEMBER = "2026-09";
const WARSAW = "Europe/Warsaw";

const jobApplication = (over: Partial<Reportable> = {}): Reportable => ({
  id: "job-application-1",
  company: "Acme",
  jobTitle: "Senior Engineer",
  location: "Warszawa",
  source: "LinkedIn",
  jobUrl: "https://example.com/jobs/42",
  appliedAt: null,
  interviews: [],
  ...over,
});

const interview = (
  heldOn: string,
  over: Partial<Interview> = {},
): Interview => ({
  id: `interview-${heldOn}`,
  jobApplicationId: "job-application-1",
  heldOn,
  heldAt: null,
  stage: "screening",
  meetingUrl: null,
  location: null,
  notes: null,
  arrangedOn: heldOn,
  cancelled: false,
  ...over,
});

const moved = (
  status: JobStatus,
  changedAt: string,
  jobApplicationId = "job-application-1",
): StatusChange => ({
  id: `status-change-${status}-${changedAt}`,
  jobApplicationId,
  status,
  changedAt,
});

const reportOf = (
  jobApplications: Reportable[],
  statusChanges: StatusChange[] = [],
  month = SEPTEMBER,
) =>
  activityReportFor({
    month,
    language: "pl",
    zone: WARSAW,
    jobApplications,
    statusChanges,
  });

/** The one row a case expects, which is most of them. */
const onlyRow = (
  jobApplications: Reportable[],
  statusChanges: StatusChange[] = [],
) => {
  const { rows } = reportOf(jobApplications, statusChanges);
  expect(rows).toHaveLength(1);
  return rows[0]!;
};

describe("which Job Applications get a row", () => {
  it("proposes nothing at all for a month nothing happened in", () => {
    expect(reportOf([jobApplication()]).rows).toEqual([]);
  });

  it("takes a Job Application the CV went out on that month", () => {
    const row = onlyRow([
      jobApplication({ appliedAt: "2026-09-05T09:00:00.000Z" }),
    ]);

    expect(row.did).toBe("5 września: Złożenie CV");
  });

  it("leaves out a Job Application applied for in another month", () => {
    expect(
      reportOf([jobApplication({ appliedAt: "2026-08-31T09:00:00.000Z" })])
        .rows,
    ).toEqual([]);
  });

  it("never proposes a bookmark, however it came to be one", () => {
    // Saving a Job Application records a Status Change like any other move, so
    // a bookmark saved this month has one — and a bookmark is not a contact
    // with an employer, so it is nowhere in the report.
    expect(
      reportOf(
        [jobApplication()],
        [moved("bookmarked", "2026-09-02T10:00:00.000Z")],
      ).rows,
    ).toEqual([]);
  });

  it("ignores the Status Change on applying and reads the day off applied_at", () => {
    // ADR-0010: the user corrects `applied_at` to the day the CV actually
    // went, and the Status Change keeps the day they got round to moving the
    // card. The date they corrected is the true one.
    const row = onlyRow(
      [jobApplication({ appliedAt: "2026-09-03T09:00:00.000Z" })],
      [moved("applied", "2026-09-10T18:00:00.000Z")],
    );

    expect(row.did).toBe("3 września: Złożenie CV");
  });

  it("makes no row of a move to Interviewing on its own", () => {
    // The invitation is the Interview's own record (ADR-0011), and printing
    // the Status move as well would report the same invitation twice on the
    // ordinary path where the user did both.
    expect(
      reportOf(
        [jobApplication()],
        [moved("interviewing", "2026-09-08T10:00:00.000Z")],
      ).rows,
    ).toEqual([]);
  });
});

describe("column 2, what the user did", () => {
  it("counts an interview held that month", () => {
    const row = onlyRow([
      jobApplication({
        interviews: [interview("2026-09-12", { stage: "rozmowa z zespołem" })],
      }),
    ]);

    expect(row.did).toBe(
      "12 września: Rozmowa kwalifikacyjna — rozmowa z zespołem",
    );
  });

  it("counts a withdrawal from its Status Change", () => {
    const row = onlyRow(
      [jobApplication({ appliedAt: "2026-09-01T09:00:00.000Z" })],
      [moved("withdrawn", "2026-09-20T12:00:00.000Z")],
    );

    expect(row.did).toBe(
      "1 września: Złożenie CV\n20 września: Wycofanie kandydatury",
    );
  });

  it("does not hold a meeting that was called off", () => {
    const row = onlyRow([
      jobApplication({
        appliedAt: "2026-09-01T09:00:00.000Z",
        interviews: [interview("2026-09-12", { cancelled: true })],
      }),
    ]);

    expect(row.did).toBe("1 września: Złożenie CV");
  });

  it("leaves column 2 empty where the month only brought something back", () => {
    const row = onlyRow(
      [jobApplication()],
      [moved("rejected", "2026-09-14T08:00:00.000Z")],
    );

    expect(row.did).toBe("");
    expect(row.back).toBe("14 września: Odmowa");
  });
});

describe("column 3, what came back", () => {
  it("counts the day a meeting was arranged, not the day it is held", () => {
    const row = onlyRow([
      jobApplication({
        interviews: [interview("2026-10-02", { arrangedOn: "2026-09-25" })],
      }),
    ]);

    expect(row.back).toBe("25 września: Zaproszenie na rozmowę");
    expect(row.did).toBe("");
  });

  it("counts an invitation to a meeting later called off", () => {
    // The employer did arrange it, and the month it was arranged in is the
    // month that answered. That it came to nothing is the row above's
    // business, not this column's.
    const row = onlyRow([
      jobApplication({
        interviews: [
          interview("2026-09-30", {
            arrangedOn: "2026-09-10",
            cancelled: true,
          }),
        ],
      }),
    ]);

    expect(row.back).toBe("10 września: Zaproszenie na rozmowę");
  });

  it("counts an offer and a rejection from their Status Changes", () => {
    const row = onlyRow(
      [jobApplication({ appliedAt: "2026-09-01T09:00:00.000Z" })],
      [
        moved("offer", "2026-09-18T15:00:00.000Z"),
        moved("rejected", "2026-09-22T15:00:00.000Z"),
      ],
    );

    expect(row.back).toBe("18 września: Oferta pracy\n22 września: Odmowa");
  });

  it("says so where the month brought nothing back at all", () => {
    const row = onlyRow([
      jobApplication({ appliedAt: "2026-09-05T09:00:00.000Z" }),
    ]);

    expect(row.back).toBe("Brak odpowiedzi");
  });
});

describe("column 1, who it was", () => {
  it("names the employer, the job, where it is and where it came from", () => {
    const row = onlyRow([
      jobApplication({ appliedAt: "2026-09-05T09:00:00.000Z" }),
    ]);

    expect(row.employer).toBe(
      "Acme\nSenior Engineer\nWarszawa\nŹródło: LinkedIn",
    );
    expect(row.link).toBe("https://example.com/jobs/42");
  });

  it("says nothing of a location or a source nobody recorded", () => {
    const row = onlyRow([
      jobApplication({
        appliedAt: "2026-09-05T09:00:00.000Z",
        location: null,
        source: null,
        jobUrl: null,
      }),
    ]);

    expect(row.employer).toBe("Acme\nSenior Engineer");
    expect(row.link).toBe("");
  });
});

describe("the order the rows come in", () => {
  it("is the order the month's first event happened in", () => {
    const first = jobApplication({
      id: "first",
      company: "First",
      appliedAt: "2026-09-02T09:00:00.000Z",
    });
    const second = jobApplication({
      id: "second",
      company: "Second",
      interviews: [
        interview("2026-09-20", {
          jobApplicationId: "second",
          arrangedOn: "2026-09-11",
        }),
      ],
    });
    const third = jobApplication({
      id: "third",
      company: "Third",
      appliedAt: "2026-09-28T09:00:00.000Z",
    });

    const { rows } = reportOf([third, second, first]);

    expect(rows.map((row) => row.id)).toEqual(["first", "second", "third"]);
  });

  it("puts a row whose month only brought a refusal where the refusal fell", () => {
    const answered = jobApplication({ id: "answered", company: "Answered" });
    const applied = jobApplication({
      id: "applied",
      company: "Applied",
      appliedAt: "2026-09-19T09:00:00.000Z",
    });

    const { rows } = reportOf(
      [answered, applied],
      [moved("rejected", "2026-09-04T08:00:00.000Z", "answered")],
    );

    expect(rows.map((row) => row.id)).toEqual(["answered", "applied"]);
  });
});

describe("the month's boundaries", () => {
  it("counts an instant by the day the user was living, not by UTC", () => {
    // Half past midnight on 1 October in Warsaw. UTC calls it the evening of
    // 30 September; the user it happened to did not.
    expect(
      reportOf(
        [jobApplication()],
        [moved("rejected", "2026-09-30T22:30:00.000Z")],
      ).rows,
    ).toEqual([]);

    const october = reportOf(
      [jobApplication()],
      [moved("rejected", "2026-09-30T22:30:00.000Z")],
      "2026-10",
    );

    expect(october.rows[0]?.back).toBe("1 października: Odmowa");
  });
});

describe("what the report carries", () => {
  it("is about the month and the language it was asked for, with nothing noted", () => {
    const report = reportOf([jobApplication()]);

    expect(report.month).toBe(SEPTEMBER);
    expect(report.language).toBe("pl");
    expect(report.notes).toBe("");
  });

  it("translates its own wording and leaves the user's words alone", () => {
    const report = activityReportFor({
      month: SEPTEMBER,
      language: "en",
      zone: WARSAW,
      jobApplications: [
        jobApplication({
          appliedAt: "2026-09-05T09:00:00.000Z",
          interviews: [interview("2026-09-12", { stage: "rozmowa z CTO" })],
        }),
      ],
      statusChanges: [],
    });

    expect(report.rows[0]?.did).toBe(
      "5 September: CV sent\n12 September: Interview — rozmowa z CTO",
    );
    expect(report.rows[0]?.employer).toContain("Source: LinkedIn");
  });
});

describe("shortOfContacts", () => {
  it("is the office's monthly minimum, counting every row on the sheet", () => {
    expect(MONTHLY_MINIMUM).toBe(3);

    const row = { id: "1", employer: "", link: "", did: "", back: "" };
    expect(shortOfContacts({ rows: [row, row] })).toBe(true);
    expect(shortOfContacts({ rows: [row, row, row] })).toBe(false);
  });
});
