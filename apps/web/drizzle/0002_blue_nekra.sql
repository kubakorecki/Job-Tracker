CREATE TABLE "extraction_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "extraction_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
