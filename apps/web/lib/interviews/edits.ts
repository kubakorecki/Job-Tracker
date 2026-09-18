import type { CreateInterview, Interview, UpdateInterview } from "@repo/schema";

/**
 * The Interviews panel's arithmetic, kept apart from the panel that renders it:
 * a meeting as text a form can hold, and what that text amounts to when it is
 * arranged or corrected. The same arrangement the Job Application's own form
 * has (`../job-applications/edits`), and for the same reasons.
 *
 * A correction names only what the user actually changed. Sending every field
 * back would work — the endpoint takes a full patch happily enough — but a
 * patch that named everything would overwrite whatever another tab had written
 * to a box this user never looked at.
 */

/** Every editable field of an Interview, as the form holds it. */
export type InterviewEdits = Record<
  | "heldOn"
  | "heldAt"
  | "stage"
  | "meetingUrl"
  | "location"
  | "notes"
  | "arrangedOn",
  string
>;

/**
 * Each field's way back from text to the shape the contract states it in. The
 * type demands one per box, so a field added to the form cannot quietly stop
 * being sent.
 *
 * Neither date needs converting: a date box and the contract both hold
 * `2026-10-01`, which is the whole reason both of an Interview's days are days
 * rather than instants (ADR-0007). Nor does the time, which is `HH:MM` in the
 * box and `HH:MM` in the contract.
 */
type ToStored = {
  [K in keyof InterviewEdits]-?: (
    text: string,
  ) => (CreateInterview & UpdateInterview)[K];
};

const trimmed = (text: string) => text.trim();
const orNull = (text: string) => (text.trim() === "" ? null : text.trim());

const TO_STORED: ToStored = {
  heldOn: trimmed,
  heldAt: orNull,
  stage: trimmed,
  meetingUrl: orNull,
  location: orNull,
  notes: orNull,
  arrangedOn: trimmed,
};

const EDITABLE_FIELDS = Object.keys(TO_STORED) as (keyof InterviewEdits)[];

/**
 * The boxes a meeting is arranged in, empty — except the day the invitation
 * arrived, which opens on today.
 *
 * Today is passed in rather than read here, like every other date reasoning in
 * this app: it is a box the user can correct, because an invitation that
 * arrived last week is not news from today, and it is shown rather than
 * defaulted quietly so they can see that it needs correcting.
 */
export function blankInterviewEdits(today: string): InterviewEdits {
  return {
    heldOn: "",
    heldAt: "",
    stage: "",
    meetingUrl: "",
    location: "",
    notes: "",
    arrangedOn: today,
  };
}

/** A meeting as a form's worth of text. Nothing unset reads as "null". */
export function interviewEditsFrom(interview: Interview): InterviewEdits {
  return {
    heldOn: interview.heldOn,
    heldAt: interview.heldAt ?? "",
    stage: interview.stage,
    meetingUrl: interview.meetingUrl ?? "",
    location: interview.location ?? "",
    notes: interview.notes ?? "",
    arrangedOn: interview.arrangedOn,
  };
}

/**
 * The meeting the boxes amount to. Every field is stated, including the day the
 * invitation arrived — the form showed it, so there is nothing for the endpoint
 * to fill in.
 *
 * A stage the contract will refuse — an empty one — is kept rather than
 * dropped, so that `CreateInterview` gets to name the problem instead of this
 * silently arranging a meeting with no stage on it.
 */
export function arrangedFrom(edits: InterviewEdits): CreateInterview {
  return {
    heldOn: TO_STORED.heldOn(edits.heldOn),
    heldAt: TO_STORED.heldAt(edits.heldAt),
    stage: TO_STORED.stage(edits.stage),
    meetingUrl: TO_STORED.meetingUrl(edits.meetingUrl),
    location: TO_STORED.location(edits.location),
    notes: TO_STORED.notes(edits.notes),
    arrangedOn: TO_STORED.arrangedOn(edits.arrangedOn),
    // A meeting is arranged as a meeting that is on. Calling one off is a
    // control of its own on a meeting that already exists.
    cancelled: false,
  };
}

/**
 * What the user changed about one meeting, as a patch. The comparison is
 * between two forms rather than between a form and a stored row, as it is on
 * the Job Application: comparing the text is what tells an untouched box from
 * one somebody typed the same value into.
 *
 * The cancellation is deliberately not in here. It is a decision rather than a
 * correction and saves on the press, like the Excitement rating and the
 * Coverage override — so a form full of unsaved edits can neither call a
 * meeting off nor put one back.
 */
export function interviewChangesFrom(
  edits: InterviewEdits,
  saved: Interview,
): UpdateInterview {
  const before = interviewEditsFrom(saved);
  const changes: UpdateInterview = {};

  for (const field of EDITABLE_FIELDS) {
    if (edits[field].trim() === before[field].trim()) continue;

    // Each converter returns its own field's stored type; indexing loses which
    // one, and the caller parses the assembled patch against the contract.
    (changes as Record<string, unknown>)[field] = TO_STORED[field](
      edits[field],
    );
  }

  return changes;
}
