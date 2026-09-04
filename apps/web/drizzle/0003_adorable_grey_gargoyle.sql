CREATE TYPE "public"."basis" AS ENUM('profile', 'tailored-cv');--> statement-breakpoint
CREATE TYPE "public"."coverage" AS ENUM('have', 'partial', 'missing');--> statement-breakpoint
CREATE TYPE "public"."necessity" AS ENUM('required', 'preferred', 'unstated');--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_application_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"skill" text NOT NULL,
	"necessity" "necessity" NOT NULL,
	"basis" "basis" DEFAULT 'profile' NOT NULL,
	"normalised_coverage" "coverage",
	"analysed_coverage" "coverage",
	"analysed_reason" text,
	"overridden_coverage" "coverage",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requirements_user_id_job_application_id_basis_position_idx" ON "requirements" USING btree ("user_id","job_application_id","basis","position");--> statement-breakpoint
--
-- Every keyword a Job Application already carried becomes one Requirement, in
-- the order the array held it, with Necessity 'unstated': the old flat list
-- never recorded whether a Posting insisted on something, and guessing upward
-- would have the tracker claim to know something it does not.
--
-- The owner comes from the Job Application the keyword sat on, which is the
-- only place it could come from and the only place it will ever be read back
-- against. Blanks are dropped rather than folded — the contract will not hold
-- a Requirement with no skill in it.
--
INSERT INTO "requirements" ("user_id", "job_application_id", "position", "skill", "necessity")
SELECT
	"job_applications"."user_id",
	"job_applications"."id",
	row_number() OVER (
		PARTITION BY "job_applications"."id"
		ORDER BY "keyword"."ordinality"
	) - 1,
	btrim("keyword"."skill"),
	'unstated'
FROM "job_applications",
	unnest("job_applications"."keywords") WITH ORDINALITY AS "keyword"("skill", "ordinality")
WHERE btrim("keyword"."skill") <> '';--> statement-breakpoint
ALTER TABLE "job_applications" DROP COLUMN "keywords";