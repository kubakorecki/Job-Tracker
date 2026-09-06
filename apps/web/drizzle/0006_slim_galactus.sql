CREATE TYPE "public"."salary_period" AS ENUM('annual', 'monthly', 'daily', 'hourly');--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "salary_period" "salary_period";