/**
 * A single choice that is either on or off, labelled with what turning it on
 * does: the dashboard's "Hide closed".
 *
 * On is filled in the page's own ink, as `Segmented`'s chosen option is and
 * for its reason — a switch that is on is not a reading, and an accent would
 * make it look like one. The label is part of the button, so the whole of it
 * is the hit target, and it sits at the toolbar's 34px so it lines up with the
 * controls beside it.
 */
export function Switch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      aria-checked={on}
      className="group inline-flex h-[34px] shrink-0 items-center gap-2 rounded-control px-1 text-[12.5px] font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectre"
      onClick={() => onChange(!on)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={`relative inline-block h-4 w-7 rounded-full border transition-colors ${
          on
            ? "border-ink bg-ink group-hover:border-ink-muted group-hover:bg-ink-muted"
            : "border-line-strong bg-paper-sunk"
        }`}
      >
        <span
          className={`absolute top-px left-px size-3 rounded-full bg-paper-raised transition-transform ${
            on ? "translate-x-3" : "border border-line-strong"
          }`}
        />
      </span>
      {label}
    </button>
  );
}
