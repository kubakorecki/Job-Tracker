import { JobStatus, RemoteType } from "@repo/schema";
import { sql } from "drizzle-orm";
import {
  index,
  numeric,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The database's own copy of the two closed sets in the shared contract,
 * derived from it rather than retyped, so a Status added to `@repo/schema`
 * turns into a migration instead of silently drifting.
 *
 * The cast is only about shape: Zod hands back an array, `pgEnum` wants a
 * non-empty tuple, and both enums are non-empty by construction.
 */
export const jobStatus = pgEnum(
  "job_status",
  JobStatus.options as [JobStatus, ...JobStatus[]],
);
export const remoteType = pgEnum(
  "remote_type",
  RemoteType.options as [RemoteType, ...RemoteType[]],
);

/**
 * A Job Application: the record of one job the user is pursuing. Mirrors
 * `JobApplication` in the shared contract, plus `normalizedJobUrl`, which the
 * contract has no reason to carry — it is the Posting's stable identity
 * (ADR-0002), stored so the database can enforce uniqueness on it.
 */
export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Deliberately no foreign key into `auth.users`: that schema belongs to
     * GoTrue, which owns and migrates it on its own schedule, and an
     * ORM-managed key into it is a standing migration hazard. Nothing is lost
     * by leaving it out — tenant isolation is enforced in application code
     * either way (ADR-0001).
     */
    userId: uuid("user_id").notNull(),
    company: text("company").notNull(),
    jobTitle: text("job_title").notNull(),
    /** Null when the Job Application has no Posting: a referral, a recruiter email. */
    jobUrl: text("job_url"),
    normalizedJobUrl: text("normalized_job_url"),
    location: text("location"),
    remoteType: remoteType("remote_type"),
    salaryMin: numeric("salary_min", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    salaryMax: numeric("salary_max", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    currency: text("currency"),
    description: text("description"),
    keywords: text("keywords").array().notNull().default([]),
    status: jobStatus("status").notNull().default("bookmarked"),
    source: text("source"),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }),
    excitement: integer("excitement"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * One Posting, one Job Application, per user. Partial because a Job
     * Application with no Posting has no identity to collide on, and many of
     * them may exist side by side.
     */
    uniqueIndex("job_applications_user_id_normalized_job_url_key")
      .on(table.userId, table.normalizedJobUrl)
      .where(sql`${table.normalizedJobUrl} is not null`),
    /** Every read is scoped by user, and the common one also filters by Status. */
    index("job_applications_user_id_status_idx").on(table.userId, table.status),
  ],
);

export type JobApplicationRow = typeof jobApplications.$inferSelect;
