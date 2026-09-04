/**
 * Query parameter names that carry per-visit tracking noise rather than
 * identity. Prefixes match from the start of the name; exact names match whole.
 * Both are compared case-insensitively, because job boards are inconsistent
 * about casing (`trackingId` on LinkedIn, `utm_source` everywhere else).
 */
const TRACKING_PARAM_PREFIXES = ["utm_", "ref"];
const TRACKING_PARAM_NAMES = new Set(["trackingid", "gh_src"]);

function isTrackingParam(name: string): boolean {
  const lowered = name.toLowerCase();
  return (
    TRACKING_PARAM_NAMES.has(lowered) ||
    TRACKING_PARAM_PREFIXES.some((prefix) => lowered.startsWith(prefix))
  );
}

/**
 * The stable identity of a Posting: the same job reached from a search page and
 * from a shared link normalizes to the same string (ADR-0002).
 *
 * Host is lowercased, the fragment is dropped, tracking parameters are
 * stripped, and the remaining parameters are sorted. The path is left alone —
 * it is case-sensitive on plenty of job boards.
 *
 * The API is the only caller: it normalizes what it stores, and normalizes a
 * URL lookup before matching on it, so the two can never be told apart by two
 * different rules. ADR-0002 has the extension normalizing before its lookup as
 * well — it does not, and does not need to: it sends the address of the tab as
 * it found it, which is what removes the disagreement the ADR was guarding
 * against rather than merely making it unlikely.
 *
 * @throws {TypeError} if `jobUrl` is not a parseable absolute URL.
 */
export function normalizeJobUrl(jobUrl: string): string {
  const url = new URL(jobUrl);

  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) {
      url.searchParams.delete(name);
    }
  }
  url.searchParams.sort();

  return url.toString();
}
