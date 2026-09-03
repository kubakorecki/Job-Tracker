/**
 * A fixed locale and time zone rather than the reader's: a record can be
 * rendered on the server and again on the client, and a date that changes with
 * the machine would be a different date in each. Every date the app shows goes
 * through it, so they all agree.
 */
const DAY = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** Any of the contract's instants, as a day the user can read. */
export function dayOf(iso: string): string {
  return DAY.format(new Date(iso));
}
