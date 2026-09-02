CREATE TYPE "public"."job_status" AS ENUM('bookmarked', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."remote_type" AS ENUM('remote', 'hybrid', 'onsite');--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" text NOT NULL,
	"job_title" text NOT NULL,
	"job_url" text,
	"normalized_job_url" text,
	"location" text,
	"remote_type" "remote_type",
	"salary_min" numeric(12, 2),
	"salary_max" numeric(12, 2),
	"currency" text,
	"description" text,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"status" "job_status" DEFAULT 'bookmarked' NOT NULL,
	"source" text,
	"applied_at" timestamp with time zone,
	"excitement" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_applications_user_id_normalized_job_url_key" ON "job_applications" USING btree ("user_id","normalized_job_url") WHERE "job_applications"."normalized_job_url" is not null;--> statement-breakpoint
CREATE INDEX "job_applications_user_id_status_idx" ON "job_applications" USING btree ("user_id","status");