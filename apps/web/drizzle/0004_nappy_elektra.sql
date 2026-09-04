CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"extracted_text" text NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
