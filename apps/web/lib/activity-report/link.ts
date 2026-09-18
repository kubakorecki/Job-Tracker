/**
 * The Posting's address, as a printed sheet can carry it.
 *
 * Two readings of one box, because the sheet has to do two things with a link
 * at once: show something a person can read across a narrow column, and stay a
 * real address the browser turns into a live link in the PDF. A job board URL
 * is routinely two hundred characters of tracking parameters, which on paper
 * is a paragraph of noise and in a cell is a column three lines taller than
 * everything beside it.
 *
 * The cell is the user's to edit like every other, so what is in it may not be
 * a URL at all — a line of their own, a company name, an empty box. That is
 * why `linkHref` answers `null` rather than throwing: text that is not an
 * address is printed as text.
 */

/**
 * How many characters of a link a column has room for. Wide enough for a host
 * and a slug, short enough that a cell stays one line of the three in a row.
 */
const ROOM_IN_A_CELL = 44;

/**
 * The address, where the text is one. `null` for anything else, including the
 * `mailto:` and `javascript:` schemes — a sheet's link is a Posting on the
 * web, and nothing else is worth making clickable in a document that leaves
 * this app.
 */
export function linkHref(text: string): string | null {
  const address = text.trim();
  if (address === "") return null;

  let url;
  try {
    url = new URL(address);
  } catch {
    return null;
  }

  return url.protocol === "http:" || url.protocol === "https:" ? address : null;
}

/**
 * The link as the sheet shows it: no scheme, no `www.`, no query string, no
 * trailing slash, and the middle of a long path taken out rather than the end
 * — the last segment of a job URL is the one that says which job it was.
 *
 * The query string goes because on a job board it is almost always tracking —
 * `?sug=sr_top&utm_source=board` says where the user was standing when they
 * clicked and nothing about the job. It is kept in the one case where dropping
 * it would leave nothing: a Posting addressed by its query alone, with no path
 * to identify it by.
 *
 * What is shown and what is linked are deliberately two different strings.
 * This is the reading; the `href` stays the address the user recorded, so a
 * shortened link in the PDF still opens the Posting it came from.
 *
 * Text that is not an address is its own short form, because there is nothing
 * to abbreviate and nothing to lose by printing what the user typed.
 */
export function shortLink(text: string): string {
  const address = linkHref(text);
  if (address === null) return text.trim();

  const url = new URL(address);
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/$/, "");
  const whole = `${host}${path === "" ? url.search : path}`;

  if (whole.length <= ROOM_IN_A_CELL) return whole;

  // The host and the tail, with the ellipsis standing for everything between
  // them. The host says who is asking and the tail says which job, and the
  // segments in the middle are the part a reader would skip anyway.
  const room = ROOM_IN_A_CELL - host.length - 1;

  // Unless the host has taken the whole cell on its own, in which case there
  // is no tail to keep and the honest thing is to cut where the room ends. A
  // host that long is somebody's internal careers system rather than a job
  // board, but a cell that silently printed `intranet.example…` and nothing
  // of the address would be worse than one that stops mid-word.
  if (room <= 0) return `${whole.slice(0, ROOM_IN_A_CELL - 1)}…`;

  return `${host}…${whole.slice(whole.length - room)}`;
}
