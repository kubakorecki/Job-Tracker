/**
 * Which column of the board a dragged card is over, read from where it is
 * across the page and nothing else.
 *
 * The columns are lanes: each one owns the full height beneath its heading,
 * however few cards it holds. Asking which column's box is nearest instead —
 * dnd-kit's `closestCorners` — goes wrong as soon as two columns differ in
 * height, because a full column's far corners sit a long way below the cursor
 * and a short neighbour's do not, so a card held over Applied lights up
 * Interviewing.
 */

export type Lane<Id> = { id: Id; left: number; right: number };

/**
 * The lane whose span takes in `x`, or, when `x` falls in the gap between two
 * or off either end of the board, the nearest one. Undefined only when there
 * are no lanes at all.
 */
export function laneAt<Id>(x: number, lanes: Lane<Id>[]): Id | undefined {
  let nearest: Lane<Id> | undefined;
  let nearestDistance = Infinity;

  for (const lane of lanes) {
    const distance = Math.max(lane.left - x, 0, x - lane.right);
    if (distance < nearestDistance) {
      nearest = lane;
      nearestDistance = distance;
    }
  }

  return nearest?.id;
}
