import type { JobApplication } from "@repo/schema";
import { todayInUtc } from "../../../../lib/day";
import { threadOf, type Beat } from "../../../../lib/job-applications/thread";
import { Panel } from "../../../panel";

/**
 * Everything that has happened on this Job Application, as a rail down the
 * right column: the day it was saved, the day it was sent, and where it stands
 * now.
 *
 * The silence gets a beat of its own rather than being a tag in a corner. It
 * is the subject the whole app is arranged around, and on the one page with
 * room to say so it is drawn as what it is — a break in a thread of things
 * that happened, with nothing in it.
 *
 * The beats are `threadOf`'s and this is only what they look like.
 */
export function SilenceThread({
  jobApplication,
}: {
  jobApplication: Pick<
    JobApplication,
    "status" | "appliedAt" | "createdAt" | "updatedAt"
  >;
}) {
  const beats = threadOf(jobApplication, todayInUtc());

  return (
    <Panel title="Since you saved it">
      <ol className="flex flex-col">
        {beats.map((beat, at) => (
          <Beat
            beat={beat}
            key={`${beat.what}-${at}`}
            last={at === beats.length - 1}
          />
        ))}
      </ol>
    </Panel>
  );
}

function Beat({ beat, last }: { beat: Beat; last: boolean }) {
  return (
    <li
      className={`grid grid-cols-[14px_minmax(0,1fr)] gap-3 ${last ? "" : "pb-4"}`}
    >
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            beat.kind === "now"
              ? "bg-ember shadow-[0_0_0_3px_var(--ember-tint)]"
              : "bg-ink-faint"
          }`}
        />
        {/* The rule breaks into a dash across a gap, which is the whole of how
            the rail says that nothing happened rather than that something
            quiet did. */}
        {!last && (
          <span
            className={`mt-1 w-[1.5px] flex-1 ${
              beat.kind === "gap"
                ? "bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_3px,transparent_3px_7px)]"
                : "bg-line-strong"
            }`}
          />
        )}
      </div>

      <div className="min-w-0">
        <p
          className={
            beat.kind === "gap"
              ? "font-display text-[17px] leading-[1.2] text-ember italic"
              : "text-[13px] leading-[1.35] font-medium text-ink"
          }
        >
          {beat.what}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink-faint">
          {beat.when}
        </p>
      </div>
    </li>
  );
}
