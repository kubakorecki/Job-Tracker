CREATE TABLE "analyses" (
	"user_id" uuid NOT NULL,
	"job_application_id" uuid NOT NULL,
	"basis" "basis" NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analyses_job_application_id_basis_pk" PRIMARY KEY("job_application_id","basis")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;