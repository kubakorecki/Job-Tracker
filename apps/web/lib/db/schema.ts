import {
  Basis,
  Coverage,
  JobStatus,
  Necessity,
  RemoteType,
} from "@repo/schema";
import { sql } from "drizzle-orm";
import {
  date,
  index,
  numeric,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The database's own copy of the closed sets in the shared contract, derived
 * from them rather than retyped, so a Status or a Necessity added to
 * `@repo/schema` turns into a migration instead of silently drifting.
 *
 * The cast is only about shape: Zod hands back an array, `pgEnum` wants a
 * non-empty tuple, and every one of these is non-empty by construction.
 */
export const jobStatus = pgEnum(
  "job_status",
  JobStatus.options as [JobStatus, ...JobStatus[]],
);
export const remoteType = pgEnum(
  "remote_type",
  RemoteType.options as [RemoteType, ...RemoteType[]],
);
export const necessity = pgEnum(
  "necessity",
  Necessity.options as [Necessity, ...Necessity[]],
);
export const coverage = pgEnum(
  "coverage",
  Coverage.options as [Coverage, ...Coverage[]],
);
export const basis = pgEnum("basis", Basis.options as [Basis, ...Basis[]]);

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

/**
 * A Requirement: one thing a Posting asks of a candidate, at the Necessity it
 * asks for it. One row per Requirement of one Job Application — which is what
 * a Job Application's asks are now, in place of the flat array of strings it
 * used to carry.
 *
 * Carries `user_id` like every other table, so that every query for a
 * Requirement can name its owner rather than inheriting one from the Job
 * Application it hangs off — tenant isolation is enforced in application code,
 * and a query that cannot name the owner cannot enforce it (ADR-0001). The
 * foreign key is the second half of that: it cascades, so deleting a Job
 * Application takes its Requirements with it.
 */
export const requirements = pgTable(
  "requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    /**
     * Where this Requirement sits in the order it was captured in — the
     * Posting's own order, for an extracted one. Stored rather than derived,
     * because `created_at` cannot tell two rows written by one statement
     * apart, and a list has an order the user can see.
     */
    position: integer("position").notNull(),
    skill: text("skill").notNull(),
    necessity: necessity("necessity").notNull(),
    /**
     * Which CV the three readings below were measured against. Only `profile`
     * is ever written today; the Tailored CV effort adds a second row per
     * Requirement rather than migrating this one (ADR-0004), at which point
     * the natural key becomes the Job Application, the Basis and the position.
     */
    basis: basis("basis").notNull().default("profile"),
    /**
     * The three readings of one Coverage, side by side and each nullable —
     * null is "this source has not spoken", which is what makes resolving them
     * a pure function of the row rather than a write-time decision (ADR-0004).
     * Nothing in this cut writes them; the columns exist so that the code
     * which does needs no migration of its own.
     */
    normalisedCoverage: coverage("normalised_coverage"),
    analysedCoverage: coverage("analysed_coverage"),
    /** The Analysis's one line on why it read the Requirement that way. */
    analysedReason: text("analysed_reason"),
    overriddenCoverage: coverage("overridden_coverage"),
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
     * Every read is one user's Requirements, for one Job Application or for
     * every Job Application on the board, in the order they were captured in.
     */
    index("requirements_user_id_job_application_id_basis_position_idx").on(
      table.userId,
      table.jobApplicationId,
      table.basis,
      table.position,
    ),
  ],
);

export type RequirementRow = typeof requirements.$inferSelect;

/**
 * A Profile: the user's master CV, as the file they uploaded and the text read
 * out of it. Keyed by the user rather than by an id of its own, which is what
 * makes "there is exactly one" a fact the database keeps instead of a rule the
 * application has to remember — a second Profile for a user cannot be written.
 *
 * The file itself is not here. It lives in a private Supabase Storage bucket
 * and this row holds where — a deliberate crossing of the v1 spec's "no file
 * storage" non-goal, because a Profile whose file is the truth about the
 * document cannot be built without keeping the document.
 */
export const profiles = pgTable("profiles", {
  /** No foreign key into `auth.users`, for the same reason as above. */
  userId: uuid("user_id").primaryKey(),
  /**
   * Where the file sits in the bucket. A fresh path every upload: a stored
   * file is never rewritten, so replacing a CV writes a new object and takes
   * the old one away rather than overwriting one in place.
   */
  storagePath: text("storage_path").notNull(),
  /** The name it was uploaded under, so a download can offer it back. */
  fileName: text("file_name").notNull(),
  /**
   * The IANA media type the file was accepted as. Text rather than an enum,
   * unlike the closed sets above: these are somebody else's vocabulary, the
   * endpoint decides which of them it accepts before anything is written, and
   * an enum would make widening that decision a migration.
   */
  mediaType: text("media_type").notNull(),
  /** The document's text, beside the file, for an Analysis to read. */
  extractedText: text("extracted_text").notNull(),
  /**
   * The skill list the user accepted. Nothing in this cut writes it — the
   * Draft that proposes it is its own ticket — so the column exists empty, the
   * way the Coverage readings above do, and the code that fills it needs no
   * migration of its own.
   */
  skills: text("skills").array().notNull().default([]),
  /**
   * When the file that is there now was uploaded, and when anything about the
   * Profile last moved. Two stamps rather than one, because an Analysis can go
   * stale on either — a new document and an edited skill list both change what
   * it was measured against.
   */
  uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ProfileRow = typeof profiles.$inferSelect;

/**
 * A Personal Access Token: the long-lived credential the user pastes into the
 * extension, standing in for the session cookie an extension origin cannot
 * have. Only the SHA-256 hash of the raw value is stored, so a reader of this
 * table — a backup, a support session, a leaked dump — cannot act as the user.
 *
 * Revocation is soft: the row survives with `revokedAt` set, so a token that
 * had to be revoked leaves a trace of when it existed and when it was last
 * used, rather than vanishing along with the evidence.
 */
export const personalAccessTokens = pgTable(
  "personal_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    /** How the user tells one machine's token from another's. */
    name: text("name").notNull(),
    /**
     * SHA-256 of the raw token, hex. Unique because authentication looks a
     * token up by this column alone — it is the only thing a request carries.
     */
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    /** Null until the token is first used to reach the API. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    /** Null while the token still works. Set once, and never unset. */
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    /** The settings page reads every token of one user, newest first. */
    index("personal_access_tokens_user_id_idx").on(table.userId),
  ],
);

export type PersonalAccessTokenRow = typeof personalAccessTokens.$inferSelect;

/**
 * How many model calls a user has spent today — job extraction, reading a CV,
 * and an Analysis all counting into the same row. One row per user per day,
 * and the day is UTC — a counter that reset at the reader's midnight would
 * reset twice for a user who flew somewhere, or not at all.
 *
 * The key is the pair, so the request that spends a call can insert and
 * increment in a single upsert and read the new total back. Nothing prunes old
 * rows: they are three columns each, and a hundred a year is not a table.
 *
 * The table is still called `extraction_usage`, from when job extraction was
 * the only thing that spent from it. The name is not worth a migration.
 */
export const modelCallUsage = pgTable(
  "extraction_usage",
  {
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);

export type ModelCallUsageRow = typeof modelCallUsage.$inferSelect;
