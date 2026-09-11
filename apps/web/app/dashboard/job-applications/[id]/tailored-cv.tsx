"use client";

import { useState, type ChangeEvent } from "react";
import { describeFailure } from "../../../../lib/api/client";
import { dayOf } from "../../../../lib/day";
import { downloadUrlFor } from "../../../../lib/profile/client";
import {
  ACCEPTED_CV_FORMATS,
  CV_FILE_ACCEPT,
  CV_TOO_LARGE,
  MAX_CV_BYTES,
  MAX_CV_MEGABYTES,
} from "../../../../lib/profile/contract";
import {
  attachTailoredCv,
  detachTailoredCv,
  fetchTailoredCv,
} from "../../../../lib/tailored-cvs/client";
import type {
  TailoredCv,
  TailoredCvOrNone,
} from "../../../../lib/tailored-cvs/contract";
import {
  DANGER_BUTTON,
  FIELD_ON_RAISED,
  PRIMARY_BUTTON,
  Problems,
  SECONDARY_BUTTON_SMALL,
  TEXT_BUTTON,
} from "../../../form";
import { Panel } from "../../../panel";

/**
 * The CV attached to this Job Application: the document the user is actually
 * sending for this job, as against the Profile, which is what they would send
 * if they had tailored nothing.
 *
 * The section is here at all because the Profile standing in is invisible
 * otherwise — a user who tailored a CV, sent it, and came back a month later
 * has no way to know which document went, and that is the question this page
 * exists to answer. So the empty state says what is being sent in the absence
 * of one, rather than only offering a file picker.
 *
 * Nothing here is part of the page's Save. Attaching a document, replacing it
 * and taking it off are each their own request, done on the press — the
 * document is not a field of the Job Application, and a file picker that only
 * took effect when somebody remembered to save would be a way to lose a CV.
 *
 * It holds no form of its own for the same reason: this renders inside the
 * form the rest of the page saves through, and a form inside a form is not a
 * document a browser will honour.
 */
export function TailoredCvSection({
  jobApplicationId,
  tailoredCv: attached,
}: {
  jobApplicationId: string;
  /** What is attached as the page was rendered, or `null` where nothing is. */
  tailoredCv: TailoredCvOrNone;
}) {
  // The Tailored CV as last read or written. Every attach, replacement and
  // refresh replaces it, so the section is never showing a link older than the
  // server's last answer.
  const [tailoredCv, setTailoredCv] = useState<TailoredCvOrNone>(attached);

  return (
    <Panel
      aside={
        tailoredCv === null ? undefined : (
          <span className="type-meta">
            {tailoredCv.fileName} · attached {dayOf(tailoredCv.uploadedAt)}
          </span>
        )
      }
      title="The CV you are sending"
    >
      <div className="flex flex-col gap-3.5">
        {tailoredCv === null ? (
          <p className="text-[12.5px] leading-[1.55] text-ink-muted">
            Nothing is attached, so this job gets the CV on your Profile. Attach
            one here if you tailored something for it, and this page will
            remember which document went.
          </p>
        ) : (
          <AttachedDocument
            jobApplicationId={jobApplicationId}
            onDetached={() => setTailoredCv(null)}
            onRefreshed={setTailoredCv}
            tailoredCv={tailoredCv}
          />
        )}

        <AttachCv
          jobApplicationId={jobApplicationId}
          onAttached={setTailoredCv}
          replacing={tailoredCv}
        />
      </div>
    </Panel>
  );
}

/**
 * Putting a document on this Job Application, whether it is the first or the
 * third. Replacing is the only way to change one — the file is the truth about
 * what was sent and is never edited — so a user who has one already is told
 * plainly what pressing this does to the file they have.
 *
 * The wait is the point of the pending state: the document is read so that
 * there is text to compare a Requirement against, which is a model call, and a
 * button that simply went quiet for ten seconds would read as a page that had
 * stopped working.
 */
function AttachCv({
  jobApplicationId,
  replacing,
  onAttached,
}: {
  jobApplicationId: string;
  replacing: TailoredCvOrNone;
  onAttached: (tailoredCv: TailoredCv) => void;
}) {
  const [chosen, setChosen] = useState<File | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  // Bumped to empty the picker, which is a remount rather than a value: a file
  // input's value cannot be set from script, and there is no form here to reset
  // one through.
  const [picker, setPicker] = useState(0);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    setProblems([]);
    setChosen(event.target.files?.[0] ?? null);
  }

  async function attach() {
    if (chosen === null) return;

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
      onAttached(await attachTailoredCv(jobApplicationId, chosen));
      // Only once it is up. A picker emptied on a failure would leave the user
      // choosing the same file again to retry.
      setChosen(null);
      setPicker((count) => count + 1);
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
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-[1.55] text-ink-muted">
        {replacing === null ? (
          <>
            {capitalised(ACCEPTED_CV_FORMATS)}, under {MAX_CV_MEGABYTES}MB. It
            is read once, so there is text to measure this Posting&rsquo;s
            Requirements against.
          </>
        ) : (
          <>
            Attaching another CV replaces {replacing.fileName} — the file you
            have now is removed, and there is no way back to it. Your Profile is
            left exactly as it is.
          </>
        )}
      </p>

      <input
        accept={CV_FILE_ACCEPT}
        aria-label="The CV you are sending for this job"
        className={`${FIELD_ON_RAISED} py-1.5 file:mr-3 file:h-[22px] file:rounded-tag file:border-0 file:bg-paper-sunk file:px-2.5 file:text-xs file:font-semibold file:text-ink-muted`}
        disabled={reading}
        key={picker}
        onChange={choose}
        type="file"
      />

      <Problems problems={problems} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`self-start ${PRIMARY_BUTTON}`}
          disabled={reading || chosen === null}
          onClick={attach}
          type="button"
        >
          {replacing === null ? "Attach and read it" : "Replace and read it"}
        </button>

        {reading && (
          <span
            aria-live="polite"
            className="text-[12.5px] leading-[1.55] text-ink-muted"
            role="status"
          >
            Reading it… the model is being asked what is in it, which takes a
            few seconds.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The document itself. A PDF is put on the page in a frame; a Markdown or plain
 * text CV is its own text, so the text is what is shown — the same reading the
 * Profile page makes of the same three formats.
 *
 * Both links are one signed URL, which lasts minutes rather than hours
 * (`CV_URL_TTL_SECONDS`) — that expiry is what lets the bucket be private. A
 * page left open outlives it, so there is a way to ask for another rather than
 * a broken frame and no explanation.
 */
function AttachedDocument({
  jobApplicationId,
  tailoredCv,
  onRefreshed,
  onDetached,
}: {
  jobApplicationId: string;
  tailoredCv: TailoredCv;
  onRefreshed: (tailoredCv: TailoredCv) => void;
  onDetached: () => void;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [detaching, setDetaching] = useState(false);

  async function refresh() {
    setProblems([]);
    setRefreshing(true);

    try {
      const read = await fetchTailoredCv(jobApplicationId);
      // `null` means somebody took it off from somewhere else. Showing the
      // empty state is the honest answer to that, and it is what the user
      // would see on reloading anyway.
      if (read === null) onDetached();
      else onRefreshed(read);
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function detach() {
    setProblems([]);
    setDetaching(true);

    try {
      await detachTailoredCv(jobApplicationId);
      onDetached();
    } catch (error) {
      setProblems(describeFailure(error));
      setDetaching(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {tailoredCv.mediaType === "application/pdf" ? (
        <iframe
          className="h-[28rem] w-full rounded-card border border-line bg-paper"
          src={tailoredCv.fileUrl}
          title={tailoredCv.fileName}
        />
      ) : (
        <pre className="max-h-[28rem] overflow-auto rounded-card border border-line bg-paper p-4 text-[12.5px] leading-[1.55] whitespace-pre-wrap text-ink-muted">
          {tailoredCv.extractedText}
        </pre>
      )}

      <Problems problems={problems} />

      <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
        <a
          className={TEXT_BUTTON}
          href={downloadUrlFor(tailoredCv)}
          rel="noreferrer"
        >
          Download it
        </a>
        <a
          className={`text-ink-muted hover:text-ink ${TEXT_BUTTON}`}
          href={tailoredCv.fileUrl}
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

      {/* Taking the document off is the one thing here that cannot be undone by
          pressing something back, so it sits behind a question and says plainly
          what is left when it is gone. */}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12.5px] leading-[1.5] text-ink-muted">
            Remove {tailoredCv.fileName}? The file is deleted, and this job goes
            back to being answered by the CV on your Profile.
          </p>
          <button
            className={DANGER_BUTTON}
            disabled={detaching}
            onClick={detach}
            type="button"
          >
            {detaching ? "Removing…" : "Remove it"}
          </button>
          <button
            className={SECONDARY_BUTTON_SMALL}
            disabled={detaching}
            onClick={() => setConfirming(false)}
            type="button"
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          className={`self-start text-ink-muted hover:text-rose ${TEXT_BUTTON}`}
          onClick={() => setConfirming(true)}
          type="button"
        >
          Remove it
        </button>
      )}
    </div>
  );
}

/** A sentence's worth of a phrase written to sit mid-sentence. */
function capitalised(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
