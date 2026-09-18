"use client";

import { useSyncExternalStore } from "react";

/**
 * A hook for one choice the user makes about how the dashboard looks, kept
 * between sessions in browser storage: the view, the Salary Period, the sort.
 *
 * Browser storage is an external store, and this reads it as one: the server
 * has none, so it renders what a stored nothing reads as, and the remembered
 * choice is picked up as the dashboard hydrates. Reading storage while
 * rendering instead would leave the server's HTML and the browser's first
 * render disagreeing.
 *
 * Each call makes a store of its own, so it is called once per choice, at the
 * top of a module, rather than inside a component.
 */
export function rememberedChoice<Choice>({
  key,
  from,
  written = String,
}: {
  /** Where in browser storage the choice is kept. */
  key: string;
  /**
   * A stored value as a choice. It is handed `null` where nothing is stored,
   * and anything at all where something is, so it decides the default and
   * what an unrecognised value reads as.
   */
  from: (stored: string | null) => Choice;
  /** A choice as the string `from` reads back. */
  written?: (choice: Choice) => string;
}): () => [Choice, (next: Choice) => void] {
  /**
   * The choice this session is showing. It is read out of storage once and then
   * kept here, which is both what makes the snapshot stable enough for
   * `useSyncExternalStore` and what keeps the control working in a browser that
   * refuses to store anything — there, the choice simply does not outlive the
   * tab.
   */
  let chosen: { choice: Choice } | null = null;

  /** Where every server render starts, since there is no storage to consult. */
  const fallback = from(null);

  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const inBrowser = () => {
    chosen ??= { choice: from(stored(key)) };
    return chosen.choice;
  };

  const choose = (next: Choice) => {
    chosen = { choice: next };
    remember(key, written(next));
    for (const listener of listeners) listener();
  };

  return function useRememberedChoice() {
    const choice = useSyncExternalStore(subscribe, inBrowser, () => fallback);
    return [choice, choose];
  };
}

/**
 * The three things anything in this app does with browser storage, each of
 * them able to fail and none of it worth failing a page over: storage can be
 * refused outright, and a private window can throw on the way in or come back
 * empty on the way out.
 *
 * Exported because the Activity Report's draft goes through them too. It is
 * not a remembered choice — a half-typed document is not a preference, and it
 * is read and written at a key that changes with the month — but it is the
 * same storage with the same ways of not being there, and two places wrapping
 * `localStorage` in two different try/catches is how one of them comes to
 * throw in a private window.
 */
export function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do and nothing to say: the choice still holds for this tab.
  }
}

/** The same, for a draft the user has finished with. */
export function forget(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // As above: there is nothing stored to fail to remove.
  }
}
