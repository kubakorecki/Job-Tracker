import { describe, expect, it } from "vitest";
import {
  CreateJobApplication,
  JobExtraction,
  ExtractJobResponse,
  JobApplication,
  UpdateJobApplication,
} from "./index.js";

const MINIMAL = { company: "Acme", jobTitle: "Engineer" };

describe("CreateJobApplication", () => {
  it("needs only a company and a job title", () => {
    expect(CreateJobApplication.safeParse(MINIMAL).success).toBe(true);
  });

  it("defaults an omitted status to bookmarked", () => {
    expect(CreateJobApplication.parse(MINIMAL).status).toBe("bookmarked");
  });

  it("defaults every omitted nullable field to null", () => {
    const created = CreateJobApplication.parse(MINIMAL);
    expect(created).toEqual({
      company: "Acme",
      jobTitle: "Engineer",
      jobUrl: null,
      location: null,
      remoteType: null,
      salaryMin: null,
      salaryMax: null,
      currency: null,
      description: null,
      keywords: [],
      status: "bookmarked",
      source: null,
      appliedAt: null,
      excitement: null,
      notes: null,
    });
  });

  it("still requires a company", () => {
    expect(
      CreateJobApplication.safeParse({ jobTitle: "Engineer" }).success,
    ).toBe(false);
  });

  it("accepts an explicit null job url", () => {
    expect(
      CreateJobApplication.safeParse({ ...MINIMAL, jobUrl: null }).success,
    ).toBe(true);
  });

  it("still rejects a job url that is not a URL", () => {
    expect(
      CreateJobApplication.safeParse({ ...MINIMAL, jobUrl: "not a url" })
        .success,
    ).toBe(false);
  });
});

describe("the create/update schemas track the field list", () => {
  const OWNED_BY_CLIENT = Object.keys(JobApplication.shape).filter(
    (name) => !["id", "userId", "createdAt", "updatedAt"].includes(name),
  );

  it("offers every client-owned field on create", () => {
    expect(Object.keys(CreateJobApplication.shape).sort()).toEqual(
      [...OWNED_BY_CLIENT].sort(),
    );
  });

  it("offers every client-owned field on update", () => {
    expect(Object.keys(UpdateJobApplication.shape).sort()).toEqual(
      [...OWNED_BY_CLIENT].sort(),
    );
  });

  it("draws the Draft's fields from the same list", () => {
    for (const name of Object.keys(JobExtraction.shape)) {
      expect(OWNED_BY_CLIENT).toContain(name);
    }
  });
});

describe("UpdateJobApplication", () => {
  it("accepts an empty patch and invents no defaults", () => {
    expect(UpdateJobApplication.parse({})).toEqual({});
  });

  it("accepts a single field", () => {
    expect(UpdateJobApplication.parse({ status: "applied" })).toEqual({
      status: "applied",
    });
  });

  it.each([1, 2, 3, 4, 5])("accepts excitement of %i", (excitement) => {
    expect(UpdateJobApplication.safeParse({ excitement }).success).toBe(true);
  });

  it.each([0, 6, 2.5])(
    "rejects excitement of %s, which is off the one-to-five scale",
    (excitement) => {
      expect(UpdateJobApplication.safeParse({ excitement }).success).toBe(
        false,
      );
    },
  );

  it("accepts excitement being cleared", () => {
    expect(UpdateJobApplication.safeParse({ excitement: null }).success).toBe(
      true,
    );
  });
});

describe("JobApplication", () => {
  const stored = {
    id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    userId: "user-1",
    ...MINIMAL,
    jobUrl: null,
    location: null,
    remoteType: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    description: null,
    keywords: [],
    status: "bookmarked",
    source: null,
    appliedAt: null,
    excitement: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("exists with no Posting behind it", () => {
    expect(JobApplication.safeParse(stored).success).toBe(true);
  });

  it("still accepts a job url when there is one", () => {
    expect(
      JobApplication.safeParse({
        ...stored,
        jobUrl: "https://example.com/jobs/1",
      }).success,
    ).toBe(true);
  });
});

describe("ExtractJobResponse", () => {
  it("carries a Draft on success", () => {
    const parsed = ExtractJobResponse.parse({
      ok: true,
      draft: { company: "Acme", jobTitle: "Engineer" },
    });
    expect(parsed).toEqual({
      ok: true,
      draft: { company: "Acme", jobTitle: "Engineer" },
    });
  });

  it.each(["no_job_found", "provider_error", "rate_limited"] as const)(
    "carries %s as a failure reason",
    (reason) => {
      expect(ExtractJobResponse.safeParse({ ok: false, reason }).success).toBe(
        true,
      );
    },
  );

  it("rejects a reason outside the three", () => {
    expect(
      ExtractJobResponse.safeParse({ ok: false, reason: "confused" }).success,
    ).toBe(false);
  });

  it("rejects a success variant with no Draft", () => {
    expect(ExtractJobResponse.safeParse({ ok: true }).success).toBe(false);
  });

  it("rejects a failure variant carrying a Draft instead of a reason", () => {
    expect(ExtractJobResponse.safeParse({ ok: false, draft: {} }).success).toBe(
      false,
    );
  });
});
