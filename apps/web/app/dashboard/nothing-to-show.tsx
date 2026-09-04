"use client";

import type {
  Emptiness,
  NarrowedBy,
} from "../../lib/job-applications/filtering";
import { TEXT_BUTTON } from "../form";
import { Empty } from "../states";

/**
 * What stands where the board or the table would, when there is nothing to put
 * in either. Which of the two things it says is `emptiness`'s decision, taken
 * over the list before it was narrowed and tested on its own; this is only the
 * wording, and the button that undoes the narrowing.
 *
 * The board is not drawn behind it. Six empty columns are a fine picture of a
 * pipeline and a poor answer to "have I saved anything at all?", and the two
 * questions are asked by the same blank screen.
 */
export function NothingToShow({
  emptiness,
  onShowEverything,
}: {
  emptiness: Emptiness;
  /** Puts the search and the Status filter back to admitting everything. */
  onShowEverything: () => void;
}) {
  if (emptiness.kind === "nothing-yet") {
    return (
      <Empty title="No Job Applications yet">
        <p>
          Add the first one with the form above — or open the extension on a
          Posting and save it from there.
        </p>
      </Empty>
    );
  }

  return (
    <Empty title="Nothing matches what you are looking for">
      <p>{MISSED[emptiness.narrowedBy]}</p>
      <button
        className={TEXT_BUTTON}
        onClick={onShowEverything}
        type="button"
      >
        Show every Job Application
      </button>
    </Empty>
  );
}

/**
 * Why the view came back empty, named by the part of the filter that emptied
 * it — so that the user knows which box to reach for even though the button
 * below clears both.
 */
const MISSED: Record<NarrowedBy, string> = {
  search:
    "No Job Application's company or job title carries what you searched for.",
  status: "You have no Job Applications at that Status.",
  both: "No Job Application at that Status carries what you searched for.",
};
