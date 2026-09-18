"use client";

import { useSyncExternalStore } from "react";
import {
  draftFrom,
  draftKey,
  writtenDraft,
} from "../../../lib/activity-report/draft";
import type { Month } from "../../../lib/activity-report/month";
import type { ActivityReport } from "../../../lib/activity-report/report";
import type { Language } from "../../../lib/activity-report/wording";
import { forget, remember, stored } from "../remembered";

/**
 * The unsent draft for one month in one language, read out of browser storage
 * as what it is: an external store.
 *
 * It is the same arrangement `rememberedChoice` makes of a preference, and for
 * the same two reasons. The server has no storage, so it renders what a stored
 * nothing reads as — nothing — and the draft is picked up as the page
 * hydrates; and what has been read is held here afterwards, which is what
 * makes the snapshot stable enough for `useSyncExternalStore` and what keeps
 * the page working in a browser that refuses to store anything, where a draft
 * simply does not outlive the tab.
 *
 * Reading it through a store rather than into state in an effect is not a
 * nicety: the key moves with the month and the language, and state that had to
 * be re-synchronised every time the user changed either would be a page whose
 * document lagged one render behind the month above it.
 */

/** Every draft this session has read or written, by the key it is filed under. */
const held = new Map<string, ActivityReport | null>();

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function announce(): void {
  for (const listener of listeners) listener();
}

/**
 * The draft filed under one key, read once and then remembered — so that two
 * renders of the same month hand back the same object rather than two equal
 * ones, which is what `useSyncExternalStore` asks for.
 */
function read(month: Month, language: Language): ActivityReport | null {
  const key = draftKey(month, language);

  if (!held.has(key)) {
    held.set(key, draftFrom(stored(key), month, language));
  }

  return held.get(key) ?? null;
}

/**
 * What the user has typed into this month in this language, or `null` where
 * they have typed nothing — which is also the answer on the server, and the
 * answer for a month that has not been chosen yet.
 */
export function useDraft(
  month: Month | null,
  language: Language,
): ActivityReport | null {
  return useSyncExternalStore(
    subscribe,
    () => (month === null ? null : read(month, language)),
    () => null,
  );
}

/**
 * Keeps a report as the draft for its own month and language.
 *
 * Written on every keystroke. A draft is small, `localStorage` is synchronous
 * and local, and the alternative — saving on a timer — is a document that
 * loses its last sentence to a closed tab.
 */
export function keepDraft(report: ActivityReport): void {
  const key = draftKey(report.month, report.language);

  held.set(key, report);
  remember(key, writtenDraft(report));
  announce();
}

/** Throws the draft away, which is what generating again does. */
export function discardDraft(month: Month, language: Language): void {
  const key = draftKey(month, language);

  held.set(key, null);
  forget(key);
  announce();
}
