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
  onSave,
  onAddManually,
}: {
  capture: Capture;
  onSave: () => void;
  onAddManually: () => void;
}) {
  const working = capture.kind === "working";

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
          {working ? "Reading the page…" : "Save this job"}
        </button>
        <AddManually disabled={working} onClick={onAddManually} />
      </div>
    </section>
  );
}

/**
 * The secondary action, wherever it stands. It opens the review form with
 * nothing in it, which is how a Job Application with no Posting behind it —
 * a referral, a recruiter's email — gets recorded.
 */
export function AddManually({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="link"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      Add manually
    </button>
  );
}
