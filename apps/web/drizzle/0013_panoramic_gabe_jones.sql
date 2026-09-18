CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_application_id" uuid NOT NULL,
	"held_on" date NOT NULL,
	"held_at" time,
	"stage" text NOT NULL,
	"meeting_url" text,
	"location" text,
	"notes" text,
	"arranged_on" date NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interviews_user_id_job_application_id_held_on_idx" ON "interviews" USING btree ("user_id","job_application_id","held_on");