import {
  Basis,
  Coverage,
  JobStatus,
  MessageRole,
  Necessity,
  RemoteType,
  SalaryPeriod,
} from "@repo/schema";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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
export const salaryPeriod = pgEnum(
  "salary_period",
  SalaryPeriod.options as [SalaryPeriod, ...SalaryPeriod[]],
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
export const messageRole = pgEnum(
  "message_role",
  MessageRole.options as [MessageRole, ...MessageRole[]],
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
    /** What the two bounds above are a rate over; null wherever they are. */
    salaryPeriod: salaryPeriod("salary_period"),
    currency: text("currency"),
    description: text("description"),
    /**
     * The day the Posting stops accepting applications. A `date` rather than a
     * timestamp, unlike `applied_at` beside it: a Posting states a day,
     * and a timestamp would have to invent a time of day and a zone to hold it
     * in — after which nothing could tell the invention from what the Posting
     * said (ADR-0007). Read as a string for the same reason: a `Date` is an
     * instant in the reader's zone, and the day would move for anyone west of
     * UTC.
     */
    closesOn: date("closes_on", { mode: "string" }),
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
 * An Analysis: that the model has read one Job Application's Requirements
 * against one Basis, and when. The verdicts themselves are not here — each one
 * belongs to the Requirement it is about, in the two analysed columns above.
 * What is here is the part that belongs to the run rather than to any one
 * Requirement.
 *
 * When it ran is the whole row, because staleness is derived rather than
 * stored: an Analysis is stale when the Profile or the Requirements moved
 * after this stamp, and both of those carry their own timestamps. A boolean
 * written here would have to be unset by every write that could invalidate it,
 * which is every write in the feature.
 *
 * Keyed by the Job Application and the Basis, so there is exactly one Analysis
 * per Basis and a re-run replaces the stamp rather than piling up history —
 * only the current reading is ever shown, and the Tailored CV effort adds its
 * own row here rather than migrating this one (ADR-0004).
 */
export const analyses = pgTable(
  "analyses",
  {
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    basis: basis("basis").notNull(),
    /** When the model last answered about this Job Application. */
    ranAt: timestamp("ran_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    /**
     * An HR reader's verdict on the run as a whole: how likely this CV is to
     * earn an interview for this Posting, 1 to 10, and one paragraph on what
     * would raise it. Nullable for a row written before this column existed,
     * and for a run whose per-Requirement readings came back usable but whose
     * overall opinion did not — the same "this source has not spoken" reading
     * the three Coverage columns above use, and it clears the same way: a
     * re-run overwrites both.
     */
    rating: integer("rating"),
    feedback: text("feedback"),
  },
  (table) => [primaryKey({ columns: [table.jobApplicationId, table.basis] })],
);

export type AnalysisRow = typeof analyses.$inferSelect;

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
 * A Tailored CV: the one CV attached to one Job Application — the document the
 * user is actually sending for this job, as against the Profile, which is what
 * they would send if they had tailored nothing.
 *
 * Keyed by the Job Application rather than by an id of its own, for the reason
 * the Profile is keyed by the user: "there is exactly one" is then a fact the
 * database keeps instead of a rule every write has to remember. The foreign key
 * cascades, so deleting a Job Application takes its Tailored CV row with it —
 * the file in the bucket is the caller's to take away, as it is on a
 * replacement.
 *
 * The columns are the Profile's, minus the skill list: a skill list is the
 * user's own side of the comparison and there is one of it, on the Profile. A
 * Tailored CV is a document and its text, and nothing else.
 */
export const tailoredCvs = pgTable(
  "tailored_cvs",
  {
    jobApplicationId: uuid("job_application_id")
      .primaryKey()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    /**
     * Where the file sits in the bucket — the same private bucket the Profile's
     * CV lives in, under the same user's folder. A fresh path every upload: a
     * stored file is never rewritten, so attaching another CV writes a new
     * object and takes the old one away rather than overwriting one in place.
     */
    storagePath: text("storage_path").notNull(),
    /** The name it was uploaded under, so a download can offer it back. */
    fileName: text("file_name").notNull(),
    /** The IANA media type the file was accepted as. Text, as on a Profile. */
    mediaType: text("media_type").notNull(),
    /**
     * The document's text, beside the file. What an Analysis against the
     * Tailored CV Basis reads, and what the page shows for a CV that is its own
     * text (ADR-0004).
     */
    extractedText: text("extracted_text").notNull(),
    /**
     * When the file that is there now was attached, and when anything about the
     * Tailored CV last moved. Two stamps for the Profile's reason: an Analysis
     * measured against this document goes stale when it moves, and the Tailored
     * CV effort reads the second of these to know that it has.
     */
    uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * Every read names the owner as well as the Job Application (ADR-0001), and
     * the key alone cannot serve a query that also filters by user.
     */
    index("tailored_cvs_user_id_idx").on(table.userId),
  ],
);

export type TailoredCvRow = typeof tailoredCvs.$inferSelect;

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

/**
 * A Conversation: the record of the user talking to the model, kept so it can
 * be returned to.
 *
 * `job_application_id` is the whole of the routing — null is the one general
 * Conversation, an id is the one attached to that Job Application — and the
 * two indexes below are what make "two kinds and no more" a fact the database
 * keeps rather than a rule every write has to remember. A Conversation is
 * therefore found by standing somewhere rather than picked off a list, which
 * is why there is no title, no archive and nothing to name.
 *
 * There is deliberately no staleness column and nothing recording what a
 * Conversation was assembled against. Every turn is built from the state of
 * that moment, so a Message is a record of something said rather than a claim
 * still being made — the opposite of an Analysis, which is stamped precisely
 * because it is a claim (`CONTEXT.md`).
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    /**
     * Null for the general Conversation. The foreign key cascades, so deleting
     * a Job Application takes its Conversation with it — and the Messages
     * below go with that, by their own cascade.
     */
    jobApplicationId: uuid("job_application_id").references(
      () => jobApplications.id,
      { onDelete: "cascade" },
    ),
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
     * One attached Conversation per Job Application per user. Nulls are
     * distinct to a unique index, so this one says nothing at all about the
     * general Conversation — which is what the partial index beside it is for.
     */
    uniqueIndex("conversations_user_id_job_application_id_key").on(
      table.userId,
      table.jobApplicationId,
    ),
    /**
     * One general Conversation per user, and the half of "two kinds and no
     * more" that the index above cannot express.
     */
    uniqueIndex("conversations_user_id_general_key")
      .on(table.userId)
      .where(sql`${table.jobApplicationId} is null`),
  ],
);

export type ConversationRow = typeof conversations.$inferSelect;

/**
 * A Message: one thing said in a Conversation, by the user or by the model.
 * Prose and nothing else — there is no Draft here and nothing a Message
 * becomes, so a cover letter is text the user reads and copies out rather than
 * a document stored a second time under another name (`CONTEXT.md`).
 *
 * Carries `user_id` like every other table, so that a query for a Message can
 * name its owner rather than inheriting one from the Conversation it hangs off
 * (ADR-0001). The foreign key cascades, so clearing is the only way to empty a
 * Conversation that keeps the row — deleting the Conversation takes its
 * Messages with it, and deleting the Job Application takes both.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    /**
     * What was said. A model Message whose stream failed partway keeps the
     * text that arrived, so this may be shorter than the reply meant to be —
     * and the column beside it is what says so. A reply that said nothing at
     * all, whether it broke before its first word or arrived as nothing but
     * whitespace, is no Message at all rather than an empty one.
     */
    text: text("text").notNull(),
    /**
     * Whether the text above is less than what was meant to be said. True on a
     * model Message whose stream broke off partway, so that what arrived is
     * kept and the panel can show the failure against it rather than leaving a
     * truncated reply looking like a short one (the spec's story 23).
     *
     * A column rather than a thing the panel is told once, in the response
     * that broke: the Conversation is reopened tomorrow, and a reply that
     * silently lost its warning would read as the model's own considered
     * answer.
     */
    incomplete: boolean("incomplete").notNull().default(false),
    /**
     * When it was said. The name a Message's own timestamp deserves: this is
     * not a row's creation stamp used for ordering by accident, it is the
     * order a conversation happened in, which is the only order it can be read
     * back in.
     */
    saidAt: timestamp("said_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /** Every read is one user's Messages in one Conversation, oldest first. */
    index("messages_user_id_conversation_id_said_at_idx").on(
      table.userId,
      table.conversationId,
      table.saidAt,
    ),
  ],
);

export type MessageRow = typeof messages.$inferSelect;

/**
 * What one user has spent on the model this month, in tokens — reading a
 * Posting, reading a CV, an Analysis and every Conversation turn alike, and
 * the model's own thinking included in each. This is AI Usage: the only
 * measure of cost the product shows, and a different question from the daily
 * Model Call count beside it (ADR-0009).
 *
 * The key is the pair, so a call that has just finished can insert and add in
 * one upsert and read the new total back — the same concurrency argument
 * `countModelCall` makes, for the same reason.
 *
 * Nothing prunes old rows: they are three columns each, and twelve a year is
 * not a table.
 */
export const aiUsage = pgTable(
  "ai_usage",
  {
    /** No foreign key into `auth.users`, for the same reason as above. */
    userId: uuid("user_id").notNull(),
    /**
     * The month, held as the UTC day it starts on. A `date` rather than a
     * `2026-09` string so that it is a calendar thing Postgres can order and
     * compare, and UTC for the reason the daily counter is: a meter that reset
     * at the reader's midnight would reset twice for a user who flew somewhere.
     */
    month: date("month", { mode: "string" }).notNull(),
    /**
     * A `bigint` rather than an `integer`: the meter keeps climbing past the
     * limit for whatever was admitted under it, and a column that wrapped
     * around at two billion would answer that the month had just begun.
     */
    tokens: bigint("tokens", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })],
);

export type AiUsageRow = typeof aiUsage.$inferSelect;
