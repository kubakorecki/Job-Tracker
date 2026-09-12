"use client";

import type { Message } from "@repo/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MAX_MESSAGE_LENGTH,
  REPLY_BROKE_OFF_MESSAGE,
} from "../lib/conversations/contract";
import { standingAt, type ConversationScope } from "../lib/conversations/scope";
import {
  DANGER_BUTTON,
  ICON_BUTTON,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SECONDARY_BUTTON_SMALL,
  TEXTAREA_ON_RAISED,
  TEXT_BUTTON,
} from "./form";
import {
  Empty,
  Failure,
  FailureBanner,
  Loading,
  Reasons,
  Skeleton,
} from "./states";
import { useConversation } from "./use-conversation";

/**
 * The Conversation, in a drawer over whatever the user was looking at.
 *
 * It hangs off the `AppBar` because the bar is the one thing on every
 * signed-in page, and asking a question should never cost the user their
 * place. It is not the bar's `action` slot: that is the page's own primary
 * thing to do, and this belongs to every page rather than to one.
 *
 * Which Conversation it shows is decided by the address and nothing else
 * (`lib/conversations/scope.ts`) — the Job Application's on its own page, the
 * general one everywhere else. There is no switcher and no picker, so the
 * header's job is to say which one this is rather than to offer another.
 *
 * An overlay rather than a rail that pushes the page aside: the board is a
 * horizontally scrolled column layout, and a panel that reflowed it would
 * rearrange the thing the user is asking about every time they asked. Nothing
 * behind it is dimmed or blocked either — the answer is usually about what is
 * on the page, and reading the two side by side is the point.
 */

/** What the trigger points at, so the bar's button and the drawer are one control. */
const PANEL_ID = "conversation-panel";

/**
 * The panel, mounted afresh for each Conversation.
 *
 * Keyed on the scope so that a navigation which changes which Conversation the
 * user is standing in takes everything held about the last one with it — what
 * was said, what was being said, and what the composer had in it. React's own
 * answer to "reset this when that changes", rather than an effect that unpicks
 * one Conversation's state to make room for the next.
 */
export function ConversationPanel() {
  const standing = standingAt(usePathname());

  return <Conversation key={standing.scope} standing={standing} />;
}

function Conversation({ standing }: { standing: ConversationScope }) {
  const { about, invites, scope, sees } = standing;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearFailure, setClearFailure] = useState<string[]>([]);

  const { said, cvAttached, reading, readFailure, taking, retry, say, clear } =
    useConversation(scope, open);

  const trigger = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Closing puts the keyboard back where it was. A drawer that left focus on
  // an element it had just taken off the page strands anyone not using a
  // mouse at the top of the document.
  const close = useCallback(() => {
    setOpen(false);
    setConfirmingClear(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Opening it puts the cursor where the user is going to type.
  useEffect(() => {
    if (open) composer.current?.focus();
  }, [open]);

  // The newest thing said stays in view as the reply is written into it.
  useEffect(() => {
    const box = scroller.current;
    if (box === null) return;

    box.scrollTop = box.scrollHeight;
  }, [open, said.messages.length, said.pending, said.writing]);

  const send = async () => {
    const text = draft.trim();
    if (text === "" || taking) return;

    setDraft("");
    setClearFailure([]);

    // A refused turn writes nothing down at all, so the words come back rather
    // than being lost to a spent allowance — unless the user has started
    // typing something else in the meantime, which is theirs.
    if (!(await say(text))) {
      setDraft((current) => (current === "" ? text : current));
    }
  };

  const nothingSaid =
    reading === "read" &&
    said.messages.length === 0 &&
    said.pending === null &&
    said.writing === null;

  return (
    <>
      <button
        aria-controls={PANEL_ID}
        aria-expanded={open}
        className={SECONDARY_BUTTON}
        onClick={() => (open ? close() : setOpen(true))}
        ref={trigger}
        type="button"
      >
        <Speech />
        Ask
      </button>

      {open && (
        <aside
          aria-label={`Conversation about ${about}`}
          // The full height of the window rather than the page below the bar:
          // `Page` is an ordinary scrolling document and the bar does not
          // stick to the top of it, so a drawer that began at 60px would show
          // a strip of whatever had scrolled under the bar above itself.
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-paper-raised sm:w-[440px]"
          id={PANEL_ID}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line bg-paper-sunk px-[18px] py-3">
            <div className="min-w-0">
              <p className="type-eyebrow text-ink-faint">Conversation</p>
              <h2 className="type-title mt-1.5 truncate text-ink">{about}</h2>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {said.messages.length > 0 && !confirmingClear && (
                <button
                  className={SECONDARY_BUTTON_SMALL}
                  disabled={taking}
                  onClick={() => {
                    setClearFailure([]);
                    setConfirmingClear(true);
                  }}
                  type="button"
                >
                  Clear
                </button>
              )}

              <button
                aria-label="Close the Conversation"
                className={ICON_BUTTON}
                onClick={close}
                type="button"
              >
                <Close />
              </button>
            </div>
          </header>

          <p className="border-b border-line px-[18px] py-2.5 text-xs leading-[1.5] text-ink-faint">
            {sees}
          </p>

          {!cvAttached && <NoCv />}

          <div
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-[18px] py-4"
            ref={scroller}
          >
            {reading === "reading" && (
              <Loading what="this Conversation">
                <Skeleton className="h-4 w-2/3 self-end" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </Loading>
            )}

            {reading === "failed" && (
              <Failure
                onRetry={retry}
                problems={readFailure}
                what="this Conversation"
              />
            )}

            {nothingSaid && (
              <Empty title="Nothing said yet.">
                <p>{invites}</p>
              </Empty>
            )}

            {said.messages.map((message) => (
              <Said key={message.id} message={message} />
            ))}

            {said.pending !== null && <Asked awaited text={said.pending} />}

            {said.writing !== null && <Reply arriving text={said.writing} />}
          </div>

          <footer className="flex flex-col gap-3 border-t border-line px-[18px] py-[14px]">
            {said.refusal.length > 0 && <Refusal problems={said.refusal} />}

            {clearFailure.length > 0 && (
              <FailureBanner heading="The Conversation was not cleared.">
                <Reasons problems={clearFailure} />
              </FailureBanner>
            )}

            {confirmingClear ? (
              <ConfirmClear
                onCancel={() => setConfirmingClear(false)}
                onClear={async () => {
                  setConfirmingClear(false);
                  setClearFailure(await clear());
                }}
              />
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <label className="sr-only" htmlFor="conversation-composer">
                  What to ask
                </label>
                <textarea
                  className={`${TEXTAREA_ON_RAISED} min-h-[68px] resize-none`}
                  id="conversation-composer"
                  maxLength={MAX_MESSAGE_LENGTH}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends, as it does in anything that is a
                    // conversation rather than a form. A new line is still one
                    // key away, and a covering letter's brief often wants one.
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ask something…"
                  ref={composer}
                  rows={3}
                  value={draft}
                />

                <div className="flex items-center justify-between gap-3">
                  <span className="type-meta">
                    Enter to send · Shift + Enter for a new line
                  </span>
                  <button
                    className={PRIMARY_BUTTON}
                    disabled={taking || draft.trim() === ""}
                    type="submit"
                  >
                    {taking ? "Writing…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </footer>
        </aside>
      )}
    </>
  );
}

/**
 * One Message, drawn by who said it.
 *
 * What the user said is a block, because it is a thing they put there; what
 * the model said is prose on the page, because it is the thing they came to
 * read — and a covering letter in a bubble is a covering letter you have to
 * get out of a bubble.
 */
function Said({ message }: { message: Message }) {
  if (message.role === "user") return <Asked text={message.text} />;

  return (
    <div className="flex flex-col items-start gap-2">
      <Reply text={message.text} />

      {/* Read off the Message rather than the event that delivered it, so a
          reply that broke off says the same thing tomorrow as it did at the
          time — which is the whole reason `incomplete` is a column. */}
      {message.incomplete && (
        <p className="text-xs leading-[1.55] text-rose">
          {REPLY_BROKE_OFF_MESSAGE}
        </p>
      )}

      <Copy text={message.text} />
    </div>
  );
}

/**
 * What the model said, whether it is a row or still arriving — one rendering,
 * so a reply does not change shape under the reader at the moment it lands.
 */
function Reply({
  arriving = false,
  text,
}: {
  arriving?: boolean;
  text: string;
}) {
  return (
    <p
      aria-busy={arriving || undefined}
      className="text-[13.5px] leading-[1.55] whitespace-pre-wrap text-ink-muted"
    >
      <span className="sr-only">The reply: </span>
      {text}
    </p>
  );
}

/** What the user said, written down or on its way. */
function Asked({ awaited = false, text }: { awaited?: boolean; text: string }) {
  return (
    <div className="flex justify-end">
      <p
        className={`max-w-[85%] rounded-card border border-line bg-paper-sunk px-3 py-2 text-[13.5px] leading-[1.55] whitespace-pre-wrap ${
          // Faint ink rather than a dimmed block: opacity double-dims over a
          // tint and cannot be tuned per surface.
          awaited ? "text-ink-faint" : "text-ink"
        }`}
      >
        <span className="sr-only">You said: </span>
        {text}
      </p>
    </div>
  );
}

/**
 * Getting a reply out of the panel in one action.
 *
 * On every model Message, because the covering letter is the point of the
 * whole feature and a drag-select across a scrolling column is not a way to
 * get a document out of an app.
 */
function Copy({ text }: { text: string }) {
  const [state, setState] = useState<"ready" | "copied" | "refused">("ready");

  useEffect(() => {
    if (state === "ready") return;

    const settle = setTimeout(() => setState("ready"), 2_400);
    return () => clearTimeout(settle);
  }, [state]);

  return (
    <button
      className={SECONDARY_BUTTON_SMALL}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          // A browser can refuse the clipboard outright, and a button that
          // said "Copied" over an empty clipboard is worse than one that
          // admits it.
          setState("refused");
        }
      }}
      type="button"
    >
      <Clipboard />
      <span aria-live="polite">
        {state === "copied"
          ? "Copied"
          : state === "refused"
            ? "Could not copy"
            : "Copy"}
      </span>
    </button>
  );
}

/**
 * A Conversation with no CV behind it. It says so plainly and goes on working:
 * a general question is not something to gate behind an upload, and finding
 * out afterwards that the advice had never read your experience is worse than
 * being told first (the spec's stories 19 and 20).
 */
function NoCv() {
  return (
    <p className="border-b border-line bg-paper px-[18px] py-2.5 text-xs leading-[1.55] text-ink-muted">
      No CV is attached to your Profile, so nothing here has read your
      experience.{" "}
      <Link className={TEXT_BUTTON} href="/settings/profile">
        Add one on your Profile
      </Link>
      . You can carry on asking either way.
    </p>
  );
}

/**
 * A turn that did not happen, in the endpoint's own words.
 *
 * The heading is the one thing true of all of them — a spent allowance, a
 * model that could not be reached and a Message that was refused each leave
 * nothing written down — and the sentence under it is the endpoint's, which is
 * where the difference and the thing to do about it live. The words the user
 * typed are back in the box below, which is the rest of the answer to "what
 * now".
 */
function Refusal({ problems }: { problems: string[] }) {
  return (
    <FailureBanner heading="Nothing was said.">
      <Reasons problems={problems} />
    </FailureBanner>
  );
}

/**
 * Clearing, asked first. There is no archive and no second Conversation of
 * this kind to go back to, so the warning says what is actually lost rather
 * than asking whether the user is sure.
 */
function ConfirmClear({
  onCancel,
  onClear,
}: {
  onCancel: () => void;
  onClear: () => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line-strong bg-paper px-3 py-2.5">
      <p className="text-[13px] leading-[1.55] text-ink-muted">
        Clear this Conversation? The Messages will not be recoverable.
      </p>
      <div className="flex gap-2">
        <button className={DANGER_BUTTON} onClick={onClear} type="button">
          Clear it
        </button>
        <button
          className={SECONDARY_BUTTON_SMALL}
          onClick={onCancel}
          type="button"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}

/** The panel's own mark: a speech bubble. 24px grid, 1.7px stroke, no fill. */
function Speech() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 20 12z" />
    </svg>
  );
}

/** The way out. */
function Close() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

/** Two sheets, one over the other. */
function Clipboard() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="13"
    >
      <rect height="13" rx="2" width="11" x="9" y="8" />
      <path d="M5 16a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2" />
    </svg>
  );
}
