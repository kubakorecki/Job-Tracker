import { Problems } from "./problems";
import type { Capture } from "./use-capture";

/**
 * The two things the panel offers on an ordinary page: read the Posting in
 * front of the user, or let them write one down themselves.
 *
 * They are separate components because they do not always appear together.
 * Reading a page is only worth offering where there is a page worth reading,
 * whereas manual entry sits beside whatever the panel is doing in every state
 * it can save from — including the settings form, which a configured user can
 * open at any time.
 */

/**
 * The primary action. It is offered on any page at all rather than only where
 * a Posting has been recognised: nothing here knows what a page holds until
 * the user asks, and asking is the point — a panel that decided for itself
 * would be wrong on exactly the sites nobody tested against.
 */
export function SaveThisJob({
  capture,
  looking,
  onSave,
  onAddManually,
}: {
  capture: Capture;
  /**
   * Whether the panel is still finding out if this Posting is already saved.
   * Reading the page before that answer arrives would risk spending an
   * extraction on a Posting the user already has (ADR-0002), so the button
   * waits — it is one request, and it is already in flight.
   */
  looking: boolean;
  onSave: () => void;
  onAddManually: () => void;
}) {
  // Only the primary button waits. Manual entry is the secondary action in
  // every state the panel could save from, and neither wait has anything to do
  // with it: a referral typed in by hand does not care what page is in front of
  // the user, or whether it turns out to be already saved.
  const working = capture.kind === "working" || looking;

  return (
    <section>
      <Problems
        problems={capture.kind === "unavailable" ? capture.problems : []}
      />

      <div className="actions">
        <button
          className="button"
          disabled={working}
          onClick={onSave}
          type="button"
        >
          {label(capture, looking)}
        </button>
        <AddManually onClick={onAddManually} />
      </div>
    </section>
  );
}

/**
 * What the primary action says it is doing. The two waits are different enough
 * to name apart: one is the panel finding out whether it should be offering
 * this at all, the other is the page being read.
 */
function label(capture: Capture, looking: boolean): string {
  if (looking) return "Checking…";
  return capture.kind === "working" ? "Reading the page…" : "Save this job";
}

/**
 * The secondary action, wherever it stands. It opens the review form with
 * nothing in it, which is how a Job Application with no Posting behind it —
 * a referral, a recruiter's email — gets recorded.
 */
export function AddManually({ onClick }: { onClick: () => void }) {
  return (
    <button className="link" onClick={onClick} type="button">
      Add manually
    </button>
  );
}
