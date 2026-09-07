import type { Metadata } from "next";
import { JobStatus } from "@repo/schema";
import { GHOSTED_AFTER_DAYS } from "../../lib/job-applications/silence";
import { Ghost, Wordmark } from "../ghost";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · ghosted.boo",
};

/**
 * The one page a signed-out visitor sees, and so the one place the app gets to
 * say what it is for before it asks for anything.
 *
 * Two halves: the statement, and the door. The statement is dark whichever
 * theme the reader is in — it is the only surface in the app that is, and it
 * is what makes a sign-in page look like a front door rather than like a form
 * somebody forgot to style. The door beside it is the app's own paper, so what
 * the user signs in to is already visible behind what they are signing in
 * through.
 *
 * On a phone the statement folds above the form rather than away: it is one
 * paragraph and three numbers, and a visitor on a small screen is exactly the
 * one who most needs to know what they have arrived at.
 */
export default function SignInPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]">
      <Statement />

      <section className="flex flex-col justify-center gap-[26px] bg-paper px-6 py-14 sm:px-12 lg:px-[72px]">
        <div>
          <h1 className="font-display text-[34px] leading-[1.15] text-ink">
            Welcome back.
          </h1>
          <p className="mt-[7px] text-[13.5px] leading-[1.55] text-ink-muted">
            Let us see who has been ignoring you.
          </p>
        </div>

        <SignInForm />

        <p className="max-w-[340px] text-xs leading-[1.6] text-ink-faint">
          Accounts are made by hand — there is no sign-up here. If you need one,
          ask the person who runs this.
        </p>
      </section>
    </main>
  );
}

/**
 * What the app is for, said once. The wit is allowed here for the same reason
 * it is allowed in an empty state: nothing has gone wrong and the user has
 * nothing to solve yet.
 */
function Statement() {
  return (
    <section className="night relative flex flex-col justify-between gap-12 overflow-hidden bg-paper px-6 py-12 text-ink sm:px-12 lg:px-16 lg:py-[60px]">
      {/* The mark, twice, at a size that stops being a picture of a ghost and
          becomes a texture. Both are decoration and neither is announced. */}
      <span className="pointer-events-none absolute -right-24 -bottom-[70px] text-white opacity-[0.045]">
        <Ghost drawing="filled" size={430} />
      </span>
      <span className="pointer-events-none absolute -top-[58px] left-[38%] text-spectre opacity-[0.06]">
        <Ghost drawing="filled" size={250} />
      </span>

      <div className="relative flex items-center gap-2.5">
        <Ghost size={24} />
        <Wordmark size={25} tail="text-spectre" />
      </div>

      <div className="relative max-w-[620px]">
        <h2 className="font-display text-[40px] leading-[1.06] tracking-[-0.017em] text-balance sm:text-[57px]">
          They said they would be in touch.{" "}
          <em className="text-spectre italic">They were not.</em>
        </h2>
        <p className="mt-[22px] max-w-[470px] text-[15px] leading-[1.65] text-ink-muted text-pretty">
          A tracker for the part nobody designs for — the weeks after you hit
          send. Every job you are chasing, how well you actually fit it, and
          exactly how long it has been since anyone had the decency to reply.
        </p>
      </div>

      <div className="relative flex flex-wrap gap-x-11 gap-y-6 border-t border-line pt-[26px]">
        {FACTS.map(({ number, says }) => (
          <div key={says}>
            <span className="block font-display text-[31px] leading-none">
              {number}
            </span>
            <span className="mt-1.5 block max-w-[150px] text-xs leading-[1.45] text-ink-faint">
              {says}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Three numbers, and every one of them read off the thing it describes rather
 * than typed in. A front page that quoted a threshold the app had since moved
 * would be the first thing a new user found out was a lie.
 */
const FACTS = [
  {
    number: GHOSTED_AFTER_DAYS,
    says: "days of silence before a job counts as ghosted",
  },
  { number: JobStatus.options.length, says: "columns, one honest pipeline" },
  { number: 0, says: "statuses guessed on your behalf" },
];
