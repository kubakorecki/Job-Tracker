import { z } from "zod";

/** The stages a job application moves through. */
export const JobStatus = z.enum([
  "bookmarked",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const RemoteType = z.enum(["remote", "hybrid", "onsite"]);
export type RemoteType = z.infer<typeof RemoteType>;

export const JobApplication = z.object({
  id: z.uuid(),
  userId: z.string(),
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  jobUrl: z.url(),
  location: z.string().nullable(),
  remoteType: RemoteType.nullable(),
  salaryMin: z.number().nonnegative().nullable(),
  salaryMax: z.number().nonnegative().nullable(),
  currency: z.string().nullable(),
  description: z.string().nullable(),
  keywords: z.array(z.string()).default([]),
  status: JobStatus,
  source: z.string().nullable(),
  appliedAt: z.iso.datetime().nullable(),
  excitement: z.number().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobApplication = z.infer<typeof JobApplication>;

/** Shape returned by the LLM extraction endpoint — a draft, not yet saved. */
export const JobExtraction = JobApplication.pick({
  company: true,
  jobTitle: true,
  location: true,
  remoteType: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  description: true,
  keywords: true,
}).partial();
export type JobExtraction = z.infer<typeof JobExtraction>;

export const CreateJobApplication = JobApplication.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  status: true,
});
export type CreateJobApplication = z.infer<typeof CreateJobApplication>;

export const UpdateJobApplication = CreateJobApplication.partial();
export type UpdateJobApplication = z.infer<typeof UpdateJobApplication>;

export const Contact = z.object({
  id: z.uuid(),
  jobApplicationId: z.uuid().nullable(),
  name: z.string().min(1),
  role: z.string().nullable(),
  company: z.string().nullable(),
  email: z.email().nullable(),
  linkedinUrl: z.url().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Contact = z.infer<typeof Contact>;

export const ActivityEventType = z.enum(["status_change", "note", "follow_up"]);
export type ActivityEventType = z.infer<typeof ActivityEventType>;

export const ActivityEvent = z.object({
  id: z.uuid(),
  jobApplicationId: z.uuid(),
  type: ActivityEventType,
  content: z.string(),
  createdAt: z.iso.datetime(),
});
export type ActivityEvent = z.infer<typeof ActivityEvent>;
