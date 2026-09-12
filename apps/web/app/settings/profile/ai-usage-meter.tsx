import {
  aiUsageSentence,
  type AiUsageReading,
} from "../../../lib/ai-usage/reading";
import { dayOf } from "../../../lib/day";
import { Panel } from "../../panel";

/**
 * What the user has spent on the model this month: the one place in the
 * product that says anything about cost, and the only limit anything in the
 * interface names.
 *
 * It is the fit banner's shape, for the same reason — a figure in the display
 * face, the sentence beside it that carries the whole reading, and a meter
 * underneath as reinforcement. Nothing here is said in colour alone: the
 * sentence says where the month stands whether or not the bar is seen, and the
 * bar is announced as nothing at all.
 *
 * There is no arithmetic here either. Both figures are read off the reading,
 * which is where the one the bar draws is clamped and the one the eye reads is
 * not — `../../../lib/ai-usage/reading` holds it so that both can be tested
 * without standing this panel up, as `fitSegments` does for the fit.
 *
 * The share is the figure and the tokens are in the sentence, because a share
 * is what the user came to read and tokens are what is metered. What a token
 * is, and what spends one, is said in words below: a number nobody can price
 * is a number that tells them nothing.
 *
 * The daily Model Call count is not here, and there is nowhere for it to be.
 * It caps what a leaked Personal Access Token can spend in a day and is
 * plumbing nobody is told about, so naming it on this panel would turn a
 * precaution into a ration (ADR-0009). Nothing here mentions plans, tiers or
 * payment either — the user is being told what they have spent, not what it
 * might one day cost.
 */
export function AiUsageMeter({ usage }: { usage: AiUsageReading }) {
  return (
    <Panel
      aside={<span className="type-meta">{usage.monthSaid}</span>}
      title="AI Usage"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-5">
          <span className="font-display text-[42px] leading-none tracking-[-0.01em] text-ink">
            {usage.percent}
            <span className="text-[26px] text-ink-faint">%</span>
          </span>

          <div className="min-w-[240px] flex-1">
            <p className="text-[13px] leading-[1.5] text-ink-muted">
              {aiUsageSentence(usage)}
            </p>

            <div
              // The sentence above says the whole of it; this is a picture of
              // the same sentence and is announced as one thing or not at all.
              aria-hidden="true"
              className="mt-2.5 h-1.5 overflow-hidden rounded-[2px] bg-line-strong"
            >
              <div
                // Ember once the month is over rather than rose: an allowance
                // that ran out is an ordinary end, and rose is what this
                // system says errors and destruction in.
                className={`h-full rounded-[2px] ${usage.isSpent ? "bg-ember" : "bg-spectre"}`}
                // The share the reading says to draw, which is the figure
                // above with any overshoot taken off it.
                style={{ width: `${usage.filled}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-[12.5px] leading-[1.55] text-ink-muted">
          A token is about four characters of text, as the model reads and
          writes them. Reading a Posting, reading a CV, running an Analysis and
          every turn of a Conversation all spend from the same monthly limit —
          tens of thousands of tokens each time, because every one of them sends
          the model your CV and the job it is reading about.
        </p>

        <p className="type-meta">
          This month&rsquo;s AI Usage starts again on{" "}
          {dayOf(usage.startsAgainOn)}.
        </p>
      </div>
    </Panel>
  );
}
