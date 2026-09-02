"use client";

import { CreateJobApplication, JobStatus } from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { describeIssues } from "../../lib/zod-issues";
import type { ApiError } from "../../lib/api/response";

const FIELD =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

/**
 * Records a Job Application by hand. It validates against the shared contract
 * before it sends anything, so the common mistakes are answered without a
 * round trip — and the endpoint validates again with the same schema, because
 * the extension will post to it too.
 */
export function AddJobApplicationForm() {
  const router = useRouter();
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = new FormData(form);
    const value = (name: string) => (values.get(name) ?? "").toString().trim();
    const jobUrl = value("jobUrl");

    const input = CreateJobApplication.safeParse({
      company: value("company"),
      jobTitle: value("jobTitle"),
      status: value("status"),
      // Omitted rather than sent empty: a Job Application with no Posting is
      // the ordinary case, and the contract's default is null.
      ...(jobUrl === "" ? {} : { jobUrl }),
    });

    if (!input.success) {
      setProblems(describeIssues(input.error));
      return;
    }

    setProblems([]);
    setSaving(true);

    try {
      const response = await fetch("/api/job-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.data),
      });

      if (!response.ok) {
        const failure: ApiError = await response.json();
        setProblems(failure.issues ?? [failure.error]);
        return;
      }

      form.reset();
      // The list is rendered on the server; this is what re-reads it.
      router.refresh();
    } catch {
      setProblems(["Could not reach the server. Try again."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm">
          <span className="mb-1 block opacity-60">Company</span>
          <input className={FIELD} name="company" />
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block opacity-60">Job title</span>
          <input className={FIELD} name="jobTitle" />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm">
          <span className="mb-1 block opacity-60">Posting URL (optional)</span>
          <input className={FIELD} name="jobUrl" />
        </label>
        <label className="text-sm sm:w-48">
          <span className="mb-1 block opacity-60">Status</span>
          <select className={FIELD} defaultValue="bookmarked" name="status">
            {JobStatus.options.map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {problems.length > 0 && (
        <ul className="text-sm text-red-600 dark:text-red-400">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <button
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        disabled={saving}
        type="submit"
      >
        {saving ? "Saving…" : "Add Job Application"}
      </button>
    </form>
  );
}
