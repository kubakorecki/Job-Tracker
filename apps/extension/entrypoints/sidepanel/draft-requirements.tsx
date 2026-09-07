import { groupedByNecessity, type Requirement } from "@repo/schema";
import { NECESSITY_LABELS } from "@repo/ui/necessity";

/**
 * What the Posting asks of a candidate, as the Draft carries it: grouped under
 * how badly it asks, and read-only.
 *
 * Read-only because of what this panel is for. A Requirement is a skill and a
 * Necessity together, so correcting one here would mean three labelled lists
 * of boxes with a dropdown against every line, in a column narrow enough to
 * make each of them wrap — and the panel's whole job is to save a Posting in
 * seconds while the user is still looking at it. They are shown so the user
 * can see what was read before they save it; the dashboard's Requirements
 * section is where a wrong one is put right, beside the Coverage that makes
 * correcting it worth the trouble.
 *
 * They ride through the save untouched either way: what is displayed here is
 * exactly what `createFrom` sends.
 */
export function DraftRequirements({
  requirements,
}: {
  requirements: Requirement[];
}) {
  // Nothing at all rather than a heading over a blank space: a Posting that
  // asks for nothing in particular is an ordinary Posting, and three empty
  // groups — or one empty one — would make it look like the extraction failed.
  if (requirements.length === 0) return null;

  return (
    <div className="requirements">
      <span className="requirements-label">Requirements</span>

      {groupedByNecessity(requirements).map(
        ({ necessity, requirements: asked }) => (
          <div key={necessity}>
            <h3>
              {NECESSITY_LABELS[necessity]} · {asked.length}
            </h3>
            <ul>
              {/*
                Keyed by position: nothing here is added to, removed or
                reordered — the list is rendered once from a Draft the user
                cannot edit — and one Posting can name the same skill in two
                places, which would make its wording a duplicate key.
              */}
              {asked.map((requirement, index) => (
                // Only the required ones are marked. The two groups are
                // already under their own headings, and colouring both would
                // say the difference twice and mean it once.
                <li data-necessity={requirement.necessity} key={index}>
                  {requirement.skill}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}

      <p className="hint">
        Nothing is guessed upward — a Requirement the Posting listed without
        saying how badly it wants it stays under Preferred. Correct these in the
        dashboard after saving.
      </p>
    </div>
  );
}
