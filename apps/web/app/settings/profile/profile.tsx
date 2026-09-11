"use client";

import { useState, type FormEvent } from "react";
import { describeFailure } from "../../../lib/api/client";
import { dayOf } from "../../../lib/day";
import {
  downloadUrlFor,
  fetchProfile,
  putProfileSkills,
  uploadCv,
} from "../../../lib/profile/client";
import {
  ACCEPTED_CV_FORMATS,
  CV_FILE_ACCEPT,
  CV_TOO_LARGE,
  MAX_CV_BYTES,
  MAX_CV_MEGABYTES,
  type Profile,
  type ProfileOrNone,
} from "../../../lib/profile/contract";
import {
  asSkills,
  newSkillEdit,
  skillEditsFrom,
  skillsChanged,
  type SkillEdit,
} from "../../../lib/profile/skill-edits";
import {
  FIELD_ON_RAISED,
  Field,
  ICON_BUTTON,
  PRIMARY_BUTTON,
  Problems,
  SECONDARY_BUTTON,
  TEXT_BUTTON,
} from "../../form";
import { Panel } from "../../panel";
import { Empty } from "../../states";

/**
 * The Profile, whole: the CV the user uploaded, the skills the model read out
 * of it while they are still a Draft, and the list they accepted and can go on
 * editing.
 *
 * The page holds the Profile in state rather than re-reading the route,
 * because an upload answers with both halves at once (`UploadedCv`) — the
 * Profile as it now stands and the Draft — and only one of those two has
 * anywhere to be read back from. A `router.refresh()` would fetch the half the
 * response already carried and could not fetch the other.
 *
 * The Draft is the whole reason this page exists in two states. It is held
 * here and nowhere else: nothing persisted it, so closing the page or pressing
 * Discard is the discard, and the accepted list is untouched either way.
 */
export function YourProfile({ profile: uploaded }: { profile: ProfileOrNone }) {
  // The Profile as last read or written. Every accepted list and every upload
  // replaces it, so the page is never measuring against something older than
  // the server's answer.
  const [profile, setProfile] = useState<ProfileOrNone>(uploaded);
  // The skill list the user accepted, as rows to correct. Seeded from the
  // Profile and reset from every answer the server gives.
  const [accepted, setAccepted] = useState<SkillEdit[]>(() =>
    skillEditsFrom(uploaded?.skills ?? []),
  );
  // The Draft: the model's proposal, corrected in place, belonging to nobody
  // until it is accepted. `null` is "there is no proposal on the table".
  const [proposed, setProposed] = useState<SkillEdit[] | null>(null);

  function onUploaded(next: Profile, proposal: string[]) {
    setProfile(next);
    // The accepted rows are deliberately left where they are. An upload
    // replaces the document and proposes a Draft; it does not touch the skill
    // list, on the server or here — so a user who was midway through
    // correcting theirs when they uploaded a new CV still is.
    setProposed(skillEditsFrom(proposal));
  }

  function onAccepted(skills: string[]) {
    // The server tidies what it was sent, so the list to show is its answer
    // rather than what went up: a duplicate the user typed twice is folded,
    // and the rows should say so.
    setProfile((current) => (current === null ? null : { ...current, skills }));
    setAccepted(skillEditsFrom(skills));
  }

  return (
    <>
      {profile === null && <FirstRun />}

      <UploadCv
        onUploaded={(answer) =>
          onUploaded(answer.profile, answer.proposedSkills)
        }
        replacing={profile}
      />

      {proposed !== null && (
        <ProposedSkills
          accepted={profile?.skills ?? []}
          onAccepted={(skills) => {
            onAccepted(skills);
            setProposed(null);
          }}
          onChange={setProposed}
          onDiscard={() => setProposed(null)}
          rows={proposed}
        />
      )}

      {profile !== null && (
        <AcceptedSkills
          onChange={setAccepted}
          onSaved={onAccepted}
          rows={accepted}
          saved={profile.skills}
        />
      )}

      {profile !== null && (
        <UploadedDocument onRefreshed={setProfile} profile={profile} />
      )}
    </>
  );
}

/**
 * What this page is for, to a user who has never uploaded anything. Without it
 * the first run is a file picker and no reason to use it — and the reason is
 * the part that is not obvious: a CV here is not a document being filed away,
 * it is the side of the comparison every Job Application is measured against.
 */
function FirstRun() {
  return (
    <Empty title="No CV here yet">
      <p>
        Your Profile is your side of the comparison — the CV you would actually
        send, kept exactly as you uploaded it, and the list of skills read out
        of it.
      </p>
      <p>
        Upload one below. It is read once, and the skills it proposes are yours
        to correct before you accept any of them.
      </p>
    </Empty>
  );
}

/**
 * Putting a CV up, whether it is the first or the fourth. Replacing is the
 * only way to change the document — the file is the truth about it and is
 * never edited — so a user who already has one is told plainly what pressing
 * this does, and what it leaves alone.
 *
 * The wait is the point of the pending state: reading a CV is a model call,
 * and a button that simply went quiet for ten seconds would read as a page
 * that had stopped working.
 */
function UploadCv({
  replacing,
  onUploaded,
}: {
  replacing: ProfileOrNone;
  onUploaded: (answer: { profile: Profile; proposedSkills: string[] }) => void;
}) {
  const [chosen, setChosen] = useState<File | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [reading, setReading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (chosen === null) return;

    // Held now rather than read after the upload: React clears `currentTarget`
    // once the handler has returned, and this one waits on a model call first.
    const form = event.currentTarget;

    // The endpoint refuses this too, and says the same thing. Asking here as
    // well saves sending a body that cannot arrive — the platform cuts one
    // this size off before the endpoint ever sees it, and the user would be
    // left with a failure nobody worded.
    if (chosen.size > MAX_CV_BYTES) {
      setProblems([CV_TOO_LARGE]);
      return;
    }

    setProblems([]);
    setReading(true);

    try {
      const answer = await uploadCv(chosen);
      onUploaded(answer);
      // Only once it is up. A picker cleared on a failure would leave the user
      // choosing the same file again to retry.
      form.reset();
      setChosen(null);
    } catch (error) {
      // Whatever the endpoint said, in its own words: an unreadable file, a
      // provider that could not be reached, a spent month of AI Usage. The three
      // are worded differently on purpose and none of them is worth
      // paraphrasing here.
      setProblems(describeFailure(error));
    } finally {
      setReading(false);
    }
  }

  return (
    <Panel title={replacing === null ? "Upload your CV" : "Replace your CV"}>
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] leading-[1.55] text-ink-muted">
          {replacing === null ? (
            <>
              {capitalised(ACCEPTED_CV_FORMATS)}, under {MAX_CV_MEGABYTES}MB.
            </>
          ) : (
            <>
              Uploading another CV replaces {replacing.fileName} — the file you
              have now is removed, and there is no way back to it. Your accepted
              skills are left exactly as they are: the new CV proposes a fresh
              list, and you choose whether to take it.
            </>
          )}
        </p>

        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <input
            accept={CV_FILE_ACCEPT}
            aria-label="Your CV"
            className={`${FIELD_ON_RAISED} py-1.5 file:mr-3 file:h-[22px] file:rounded-tag file:border-0 file:bg-paper-sunk file:px-2.5 file:text-xs file:font-semibold file:text-ink-muted`}
            disabled={reading}
            name="cv"
            onChange={(event) => {
              setProblems([]);
              setChosen(event.target.files?.[0] ?? null);
            }}
            type="file"
          />

          <Problems problems={problems} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              className={`self-start ${PRIMARY_BUTTON}`}
              disabled={reading || chosen === null}
              type="submit"
            >
              {replacing === null
                ? "Upload and read it"
                : "Replace and read it"}
            </button>

            {reading && (
              <span
                aria-live="polite"
                className="text-[12.5px] leading-[1.55] text-ink-muted"
                role="status"
              >
                Reading your CV… the model is being asked what is in it, which
                takes a few seconds.
              </span>
            )}
          </div>
        </form>
      </div>
    </Panel>
  );
}

/**
 * Saying what the skill list should be, and what comes of saying it. One hook
 * for both sections, because both make the one request: accepting a Draft and
 * correcting the list months later are the same write, which is why there is
 * one endpoint behind them and no separate accept.
 *
 * The answer is handed on rather than kept, because the server tidies what it
 * was sent — the list to show afterwards is its reply, not what went up.
 */
function useSayingWhatTheListIs(onSaid: (skills: string[]) => void) {
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function say(rows: SkillEdit[]) {
    setProblems([]);
    setSaving(true);

    try {
      const answer = await putProfileSkills(asSkills(rows));
      onSaid(answer.skills);
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  return { problems, saving, say };
}

/**
 * The Draft: what the model read out of the CV, before it is anybody's.
 *
 * Every row is editable and the list can be added to and taken from, because
 * accepting is not agreeing — it is saying what the list should be, and what
 * the user sends may be nothing the model proposed. Discarding writes nothing
 * and asks nothing: the proposal was never stored, so letting go of it here is
 * the whole of it.
 */
function ProposedSkills({
  rows,
  accepted,
  onChange,
  onAccepted,
  onDiscard,
}: {
  rows: SkillEdit[];
  accepted: string[];
  onChange: (rows: SkillEdit[]) => void;
  onAccepted: (skills: string[]) => void;
  onDiscard: () => void;
}) {
  const {
    problems,
    saving: accepting,
    say,
  } = useSayingWhatTheListIs(onAccepted);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await say(rows);
  }

  return (
    <Panel title="Skills read from your CV">
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] leading-[1.55] text-ink-muted">
          {accepted.length === 0
            ? "Nothing is saved yet. Correct anything that is wrong, add what was missed, then accept the list."
            : `Correct anything that is wrong, then accept it — it replaces the ${countOf(accepted.length, "skill")} on your Profile. Discard it and that list stays exactly as it is.`}
        </p>

        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <SkillRows
            addLabel="Add a skill the CV missed"
            whenEmpty="The model proposed nothing. Add what you can do, or discard this and try another CV."
            onChange={onChange}
            rows={rows}
          />

          <Problems problems={problems} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              className={PRIMARY_BUTTON}
              disabled={accepting}
              type="submit"
            >
              {accepting ? "Accepting…" : "Accept these skills"}
            </button>
            <button
              className={`text-[12.5px] text-ink-muted hover:text-ink ${TEXT_BUTTON}`}
              disabled={accepting}
              onClick={onDiscard}
              type="button"
            >
              Discard them
            </button>
          </div>
        </form>
      </div>
    </Panel>
  );
}

/**
 * The list the user accepted, and has been editing ever since. The same rows
 * and the same request as the Draft above it: from here on the list is theirs,
 * with no proposal behind it and no relation to the document — editing it
 * touches nothing about the file.
 */
function AcceptedSkills({
  rows,
  saved,
  onChange,
  onSaved,
}: {
  rows: SkillEdit[];
  saved: string[];
  onChange: (rows: SkillEdit[]) => void;
  onSaved: (skills: string[]) => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const { problems, saving, say } = useSayingWhatTheListIs((skills) => {
    onSaved(skills);
    setNotice("Saved.");
  });

  function edit(next: SkillEdit[]) {
    setNotice(null);
    onChange(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Nothing to say is not the same as saying nothing: this spends no
    // request, where clearing the last skill spends one and empties the list.
    if (!skillsChanged(rows, saved)) {
      setNotice("Nothing has changed.");
      return;
    }

    setNotice(null);
    await say(rows);
  }

  return (
    <Panel title="Your skills">
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] leading-[1.55] text-ink-muted">
          What a Job Application is measured against. Yours to word however you
          word it — changing this leaves the document alone.
        </p>

        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <SkillRows
            addLabel="Add a skill"
            whenEmpty="Nothing accepted yet. Accept a list read from your CV, or type your skills in here."
            onChange={edit}
            rows={rows}
          />

          <Problems problems={problems} />

          <div className="flex items-center gap-3">
            <button className={PRIMARY_BUTTON} disabled={saving} type="submit">
              {saving ? "Saving…" : "Save your skills"}
            </button>
            {notice !== null && (
              <span aria-live="polite" className="type-meta">
                {notice}
              </span>
            )}
          </div>
        </form>
      </div>
    </Panel>
  );
}

/**
 * A skill list as a column of boxes. One component for the Draft and for the
 * accepted list, because correcting a proposal and editing what you accepted
 * are the same gesture on the same shape — which is also why one endpoint
 * takes both.
 *
 * Nothing here saves. The list is handed up as rows and the section around it
 * decides what to do with them, so the Draft can be discarded without ever
 * having been anywhere.
 */
function SkillRows({
  rows,
  addLabel,
  whenEmpty,
  onChange,
}: {
  rows: SkillEdit[];
  addLabel: string;
  whenEmpty: string;
  onChange: (rows: SkillEdit[]) => void;
}) {
  const [typed, setTyped] = useState("");
  const skill = typed.trim();

  function add() {
    if (skill === "") return;
    onChange([...rows, newSkillEdit(skill)]);
    setTyped("");
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Skills</legend>

      {rows.length === 0 ? (
        <p className="text-[12.5px] leading-[1.55] text-ink-muted">
          {whenEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li className="flex items-center gap-2" key={row.key}>
              <input
                aria-label="Skill"
                className={`${FIELD_ON_RAISED} min-w-0 flex-1`}
                onChange={(event) =>
                  onChange(
                    rows.map((other) =>
                      other.key === row.key
                        ? { ...other, skill: event.target.value }
                        : other,
                    ),
                  )
                }
                value={row.skill}
              />
              <button
                aria-label={
                  row.skill.trim() === ""
                    ? "Remove this skill"
                    : `Remove ${row.skill}`
                }
                className={ICON_BUTTON}
                onClick={() =>
                  onChange(rows.filter((other) => other.key !== row.key))
                }
                type="button"
              >
                <Cross />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label={addLabel}>
          <input
            className={FIELD_ON_RAISED}
            onChange={(event) => setTyped(event.target.value)}
            // Enter in a box inside a form submits it, which here would save
            // the list and leave the typed skill behind in this box.
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
            placeholder="Something you can do"
            value={typed}
          />
        </Field>
        <button
          className={SECONDARY_BUTTON}
          disabled={skill === ""}
          onClick={add}
          type="button"
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}

/**
 * The document itself. A PDF is put on the page in a frame; a Markdown or
 * plain text CV is its own text, so the text is what is shown — for those two
 * the extracted text is a decoding of the file rather than a reading of it,
 * and there is nothing else it could be.
 *
 * Both links are the same signed URL, which lasts minutes rather than hours
 * (`CV_URL_TTL_SECONDS`) — that expiry is what lets the bucket be private. A
 * page left open outlives it, so there is a way to ask for another rather than
 * a broken frame and no explanation.
 */
function UploadedDocument({
  profile,
  onRefreshed,
}: {
  profile: Profile;
  onRefreshed: (profile: Profile) => void;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setProblems([]);
    setRefreshing(true);

    try {
      const read = await fetchProfile();
      // `null` cannot happen while this section is on screen — it renders only
      // for a Profile — but a Profile deleted from under the page is not worth
      // a crash, and leaving what is on screen is the right answer to it.
      if (read !== null) onRefreshed(read);
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Panel
      aside={
        <span className="type-meta">
          {profile.fileName} · uploaded {dayOf(profile.uploadedAt)}
        </span>
      }
      title="Your CV"
    >
      <div className="flex flex-col gap-3">
        {profile.mediaType === "application/pdf" ? (
          <iframe
            className="h-[32rem] w-full rounded-card border border-line bg-paper"
            src={profile.fileUrl}
            title={profile.fileName}
          />
        ) : (
          <pre className="max-h-[32rem] overflow-auto rounded-card border border-line bg-paper p-4 text-[12.5px] leading-[1.55] whitespace-pre-wrap text-ink-muted">
            {profile.extractedText}
          </pre>
        )}

        <Problems problems={problems} />

        <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
          <a
            className={TEXT_BUTTON}
            href={downloadUrlFor(profile)}
            rel="noreferrer"
          >
            Download it
          </a>
          <a
            className={`text-ink-muted hover:text-ink ${TEXT_BUTTON}`}
            href={profile.fileUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open it in a tab
          </a>
          <span className="text-ink-faint">
            These links last a few minutes.{" "}
            <button
              className={TEXT_BUTTON}
              disabled={refreshing}
              onClick={refresh}
              type="button"
            >
              {refreshing ? "Asking…" : "Get fresh ones"}
            </button>
          </span>
        </div>
      </div>
    </Panel>
  );
}

/** Taking a skill out of the list: 24px grid, 1.7px stroke, no fill. */
function Cross() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

/** "3 skills", "1 skill" — the count and its noun agreeing. */
function countOf(many: number, noun: string): string {
  return `${many} ${noun}${many === 1 ? "" : "s"}`;
}

/** A sentence's worth of a phrase written to sit mid-sentence. */
function capitalised(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
