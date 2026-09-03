"use client";

import { CreateJobApplication, JobStatus } from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { describeIssues } from "../../lib/zod-issues";
import { describeFailure } from "../../lib/api/client";
import { postJobApplication } from "../../lib/job-applications/client";
import { FIELD, Field, PRIMARY_BUTTON, Problems, Row } from "../form";
import { JOB_APPLICATIONS_KEY } from "./use-job-applications";

/**
 * Records a Job Application by hand. It validates against the shared contract
 * before it sends anything, so the common mistakes are answered without a
 * round trip — and the endpoint validates again with the same schema, because
 * the extension will post to it too.
 */
export function AddJobApplicationForm() {
  const queryClient = useQueryClient();
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
      await postJobApplication(input.data);
      form.reset();
      // The board reads one cached list; this is what re-reads it.
      await queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_KEY });
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <Row>
        <Field label="Company">
          <input className={FIELD} name="company" />
        </Field>
        <Field label="Job title">
          <input className={FIELD} name="jobTitle" />
        </Field>
      </Row>

      <Row>
        <Field label="Posting URL (optional)">
          <input className={FIELD} name="jobUrl" />
        </Field>
        <Field label="Status">
          <select className={FIELD} defaultValue="bookmarked" name="status">
            {JobStatus.options.map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <Problems problems={problems} />

      <button
        className={`self-start ${PRIMARY_BUTTON}`}
        disabled={saving}
        type="submit"
      >
        {saving ? "Saving…" : "Add Job Application"}
      </button>
    </form>
  );
}
