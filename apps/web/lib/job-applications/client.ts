import type {
  CreateJobApplication,
  JobApplication,
  UpdateJobApplication,
} from "@repo/schema";
import { send } from "../api/client";

/**
 * The Job Applications endpoints, as the browser addresses them. Each function
 * takes the shared contract's type, which is the same type the endpoint
 * validates against; how a request is sent and how a refusal is read is
 * `../api/client`'s business.
 */

const ENDPOINT = "/api/job-applications";

export async function fetchJobApplications(): Promise<JobApplication[]> {
  return send(ENDPOINT);
}

export async function postJobApplication(
  input: CreateJobApplication,
): Promise<JobApplication> {
  return send(ENDPOINT, { method: "POST", body: input });
}

export async function patchJobApplication(
  id: string,
  patch: UpdateJobApplication,
): Promise<JobApplication> {
  return send(`${ENDPOINT}/${id}`, { method: "PATCH", body: patch });
}

/** Removing a Job Application. The confirmation step is the caller's. */
export async function deleteJobApplication(id: string): Promise<void> {
  await send(`${ENDPOINT}/${id}`, { method: "DELETE" });
}
