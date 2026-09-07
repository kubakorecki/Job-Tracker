"use client";

import type {
  Emptiness,
  NarrowedBy,
} from "../../lib/job-applications/filtering";
import { SECONDARY_BUTTON_SMALL, PRIMARY_BUTTON } from "../form";
import { Empty } from "../states";

/**
 * What stands where the board or the table would, when there is nothing to put
 * in either. Which of the two things it says is `emptiness`'s decision, taken
 * over the list before it was narrowed and tested on its own; this is only the
 * wording, and the buttons that undo it.
 *
 * The board is not drawn behind it. Six empty columns are a fine picture of a
 * pipeline and a poor answer to "have I saved anything at all?", and the two
 * questions are asked by the same blank screen.
 *
 * This is one of the three places the app is allowed to be dry — an empty
 * board is not a problem the user has to solve.
 */
export function NothingToShow({
  emptiness,
  onShowEverything,
  onTrackAJob,
}: {
  emptiness: Emptiness;
  /** Puts every part of the toolbar back to admitting everything. */
  onShowEverything: () => void;
  /** Opens the panel that records one by hand. */
  onTrackAJob: () => void;
}) {
  if (emptiness.kind === "nothing-yet") {
    return (
      <Empty drawing="solid" title="Nothing out there yet.">
        <p>
          Track your first job and the board fills itself in. Or open the
          extension on a Posting you are already reading and save it from the
          page.
        </p>
        <button className={PRIMARY_BUTTON} onClick={onTrackAJob} type="button">
          Track a job
        </button>
      </Empty>
    );
  }

  return (
    <Empty title="No sign of it.">
      <p>
        {missed(emptiness.narrowedBy)} The filters are doing more work than you
        meant them to.
      </p>
      <button
        className={SECONDARY_BUTTON_SMALL}
        onClick={onShowEverything}
        type="button"
      >
        Show everything
      </button>
    </Empty>
  );
}

/**
 * Why the view came back empty, named by the parts of the toolbar that emptied
 * it — so that the user knows which control to reach for even though the
 * button below clears all of them.
 *
 * Composed from the parts rather than written out per combination: there are
 * three controls and seven ways to have narrowed with them, and seven
 * sentences kept in step with one another is six too many.
 */
function missed(narrowedBy: NarrowedBy[]): string {
  const clauses = narrowedBy.map((part) => MISSED[part]);
  const last = clauses.pop() ?? "matches what you are looking for";

  return `No Job Application ${clauses.length === 0 ? last : `${clauses.join(", ")} and ${last}`}.`;
}

const MISSED: Record<NarrowedBy, string> = {
  status: "sits at that Status",
  silence: "has been quiet that long",
  search: "carries what you searched for",
};
