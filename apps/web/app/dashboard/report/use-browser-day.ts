"use client";

import { useSyncExternalStore } from "react";
import { browserZone, todayInZone } from "../../../lib/day";

/**
 * Where and when the reader is: the zone their months are counted in, and the
 * day it is there.
 *
 * Both are read in the browser and nowhere else, which is the whole reason
 * this is a hook rather than two calls (ADR-0012). The server has no zone worth
 * having — it renders in whatever the host runs in — and an Activity Report
 * generated from its answer would put a Saturday night in the wrong month for
 * anybody far enough from it. So the server renders the page with no report on
 * it at all, and the browser fills it in as it hydrates.
 *
 * `useSyncExternalStore` rather than an effect, for the reason
 * `rememberedChoice` uses one: what the server rendered and what the browser
 * renders first have to agree, and the way to make them agree is for the
 * server's snapshot to be its own answer — `null`, meaning "nobody has said
 * yet" — rather than a guess that hydration then corrects.
 */
export type BrowserDay = {
  /** An IANA zone, as the browser resolves it. */
  zone: string;
  /** Today, as a `YYYY-MM-DD` in that zone. */
  today: string;
};

/**
 * Read once per session and held. Nothing here subscribes to anything, because
 * neither answer changes while the page is open — except at midnight, which a
 * document about last month has no reason to notice, and which the user
 * reloading tomorrow settles anyway.
 */
let resolved: BrowserDay | null = null;

/** Nothing ever notifies, so subscribing is a formality the hook requires. */
const subscribe = () => () => {};

function inBrowser(): BrowserDay {
  if (resolved === null) {
    const zone = browserZone();
    resolved = { zone, today: todayInZone(zone) };
  }

  return resolved;
}

/** `null` on the server, and the reader's own zone and day in the browser. */
export function useBrowserDay(): BrowserDay | null {
  return useSyncExternalStore(subscribe, inBrowser, () => null);
}
