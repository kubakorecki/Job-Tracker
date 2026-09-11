CREATE TABLE "tailored_cvs" (
	"job_application_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"extracted_text" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tailored_cvs" ADD CONSTRAINT "tailored_cvs_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tailored_cvs_user_id_idx" ON "tailored_cvs" USING btree ("user_id");