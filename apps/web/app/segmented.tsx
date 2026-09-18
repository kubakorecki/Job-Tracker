/**
 * A row of options where one is chosen, for a choice short enough to show its
 * whole range: the dashboard's view and Salary Period, the Activity Report's
 * language.
 *
 * The chosen one is filled in the page's own ink rather than in an accent — a
 * toggle that is on is not a reading, and colouring it `vital` or `rose` would
 * make it look like one. It answers the pointer even when it is already the
 * chosen one, because pressing another is what the control is for and a dead
 * button beside a live one reads as broken.
 *
 * It lives here rather than beside the dashboard for the reason `form.tsx`'s
 * pieces do: a second copy grown on another page is how two controls that do
 * the same thing come to look different.
 */
export function Segmented<Value extends string>({
  label,
  value,
  options,
  onChoose,
}: {
  label: string;
  value: Value;
  options: { value: Value; label: string; count?: number }[];
  onChoose: (value: Value) => void;
}) {
  return (
    <div
      aria-label={label}
      className="inline-flex shrink-0 overflow-hidden rounded-control border border-line-strong bg-paper-raised"
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={`h-[32px] border-r border-line-strong px-3 text-[12.5px] font-medium last:border-r-0 ${
            option.value === value
              ? "bg-ink text-paper-raised hover:bg-ink-muted"
              : "text-ink-muted hover:text-ink"
          }`}
          key={option.value}
          onClick={() => onChoose(option.value)}
          type="button"
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={`ml-1.5 font-normal ${
                option.value === value ? "text-paper-sunk" : "text-ink-faint"
              }`}
            >
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
