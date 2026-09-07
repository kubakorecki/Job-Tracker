"use client";

import { CreateJobApplication, JobStatus } from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { describeIssues } from "../../lib/zod-issues";
import { describeFailure } from "../../lib/api/client";
import { postJobApplication } from "../../lib/job-applications/client";
import {
  FIELD_ON_RAISED,
  Field,
  PRIMARY_BUTTON,
  Problems,
  Row,
  SELECT_ON_RAISED,
} from "../form";
import { JOB_APPLICATIONS_KEY } from "./use-job-applications";

/**
 * Records a Job Application by hand. It validates against the shared contract
 * before it sends anything, so the common mistakes are answered without a
 * round trip — and the endpoint validates again with the same schema, because
 * the extension will post to it too.
 */
export function AddJobApplicationForm({
  onSaved,
}: {
  /**
   * Told when one has been recorded, so the panel the form was opened in can
   * close itself. The form has no opinion about where it is standing, which is
   * why it reports rather than closes.
   */
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = new FormData(form);
    const value = (name: string) => (values.get(name) ?? "").toString().trim();
    const jobUrl = value("jobUrl");
    const closesOn = value("closesOn");

    const input = CreateJobApplication.safeParse({
      company: value("company"),
      jobTitle: value("jobTitle"),
      status: value("status"),
      // Omitted rather than sent empty: a Job Application with no Posting is
      // the ordinary case, and the contract's default is null. The Closing
      // Date goes the same way, for the same reason.
      ...(jobUrl === "" ? {} : { jobUrl }),
      ...(closesOn === "" ? {} : { closesOn }),
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
      onSaved?.();
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
          <input className={FIELD_ON_RAISED} name="company" />
        </Field>
        <Field label="Job title">
          <input className={FIELD_ON_RAISED} name="jobTitle" />
        </Field>
      </Row>

      <Row>
        <Field label="Posting URL (optional)">
          <input className={FIELD_ON_RAISED} name="jobUrl" />
        </Field>
        <Field label="Status">
          <select
            className={SELECT_ON_RAISED}
            defaultValue="bookmarked"
            name="status"
          >
            {JobStatus.options.map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>

        {/* The one field worth asking for beyond a name and a Status: a
            bookmark made by hand is made at the moment the user knows the
            Closing Date, and one recorded later is a Closing Date the user had
            to come back for (ADR-0007). */}
        <Field label="Closes on (optional)">
          <input className={FIELD_ON_RAISED} name="closesOn" type="date" />
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
