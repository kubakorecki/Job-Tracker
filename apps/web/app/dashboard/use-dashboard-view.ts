"use client";

import { useSyncExternalStore } from "react";
import {
  DASHBOARD_VIEW_KEY,
  DEFAULT_VIEW,
  viewFrom,
  type DashboardView,
} from "../../lib/dashboard/view";

/**
 * The view the user last chose, remembered between sessions.
 *
 * Browser storage is an external store, and this reads it as one: the server
 * has none, so it renders the default view, and the remembered one is picked
 * up as the dashboard hydrates. Reading storage while rendering instead would
 * leave the server's HTML and the browser's first render disagreeing.
 */
export function useDashboardView(): [
  DashboardView,
  (view: DashboardView) => void,
] {
  const view = useSyncExternalStore(subscribe, inBrowser, onServer);

  return [
    view,
    (next) => {
      chosen = next;
      remember(next);
      for (const listener of listeners) listener();
    },
  ];
}

/**
 * The choice this session is showing. It is read out of storage once and then
 * kept here, which is both what makes the snapshot stable enough for
 * `useSyncExternalStore` and what keeps the toggle working in a browser that
 * refuses to store anything — there, the choice simply does not outlive the tab.
 */
let chosen: DashboardView | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function inBrowser(): DashboardView {
  chosen ??= viewFrom(stored());
  return chosen;
}

/** Where every server render starts, since there is no storage to consult. */
function onServer(): DashboardView {
  return DEFAULT_VIEW;
}

/**
 * Storage can be unavailable — a browser set to refuse it, a private window —
 * and that is not worth failing a dashboard over.
 */
function stored(): string | null {
  try {
    return window.localStorage.getItem(DASHBOARD_VIEW_KEY);
  } catch {
    return null;
  }
}

function remember(view: DashboardView): void {
  try {
    window.localStorage.setItem(DASHBOARD_VIEW_KEY, view);
  } catch {
    // Nothing to do and nothing to say: the choice still holds for this tab.
  }
}
