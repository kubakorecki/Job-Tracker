/**
 * The mark and the name, at the bar's own size.
 *
 * It is drawn here rather than imported from `apps/web`: the two apps share a
 * contract package and a component package, not a page tree, and one 24px path
 * is a smaller thing to state twice than a dependency between two apps' `app`
 * directories would be. It is the same path, on the same 24px grid, with the
 * same two eyes — the one place in the system anything is filled.
 */
export function Wordmark() {
  return (
    <span className="wordmark">
      <svg
        aria-hidden="true"
        fill="none"
        height="17"
        viewBox="0 0 24 24"
        width="17"
      >
        <path
          d="M4 21V10a8 8 0 0 1 16 0v11 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <circle cx="9.2" cy="10.8" fill="currentColor" r="1.1" />
        <circle cx="14.8" cy="10.8" fill="currentColor" r="1.1" />
      </svg>
      ghosted<span className="tld">.boo</span>
    </span>
  );
}
