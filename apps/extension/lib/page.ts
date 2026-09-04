import { browser } from "#imports";

/**
 * Reading the Posting the user is looking at. This is the only part of the
 * panel that touches the page itself, and it does so once per click and never
 * on open: extraction costs the user a share of a daily grant, so a panel that
 * read every tab it was opened over would spend it on pages nobody asked
 * about.
 *
 * There is no content script. The manifest asks for `activeTab` and
 * `scripting`, so the read is a one-off injection into the tab the user
 * invoked the extension on, and the extension holds no standing access to any
 * site.
 */

/**
 * What the panel managed to read. A tab it cannot read is an ordinary outcome
 * rather than an exception — Chrome's own pages, the PDF viewer, and a tab the
 * `activeTab` grant no longer covers all land here — and the panel answers it
 * the way it answers a provider failure: with the review form and an
 * explanation.
 */
export type ActivePosting =
  | { kind: "read"; url: string; pageText: string }
  | { kind: "unreadable"; url: string | null; problem: string };

/**
 * What a tab that cannot be read leaves the user to do. The remedy is the same
 * whichever way the read failed, so it is worded once: `activeTab` is granted
 * by invoking the extension on a tab, and re-opening the panel from the
 * toolbar icon is how a user re-grants it.
 */
const UNREADABLE =
  "This tab could not be read. Open the panel from the toolbar icon on the page you want to save, or fill the details in below.";

/**
 * Where the user is, and nothing else. The panel asks this on open, to find
 * out whether the Posting in front of them is one they have already saved
 * (ADR-0002) — so it must cost nothing: no injection, no page read, and no
 * share of the extraction grant. `tab.url` is known wherever the extension has
 * access to the tab, and `null` says it does not, which the panel answers by
 * offering to read the page in the ordinary way.
 */
export async function readActiveUrl(): Promise<string | null> {
  const tab = await activeTab();
  return tab?.url ?? null;
}

export async function readActivePosting(): Promise<ActivePosting> {
  const tab = await activeTab();

  if (tab?.id === undefined) {
    return { kind: "unreadable", url: null, problem: UNREADABLE };
  }

  // Known only where the extension has access to the tab, which is the same
  // condition the injection below needs — so a missing URL is already a sign
  // the read will fail, and it is reported as one rather than guessed at.
  const url = tab.url ?? null;

  let text: string | undefined;
  try {
    const [injected] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: visibleText,
    });
    text = injected?.result;
  } catch {
    return { kind: "unreadable", url, problem: UNREADABLE };
  }

  if (url === null || text === undefined || text.trim() === "") {
    return { kind: "unreadable", url, problem: UNREADABLE };
  }

  return { kind: "read", url, pageText: text };
}

/**
 * What the page says, as a reader sees it. It runs in the tab rather than
 * here, so it is deliberately self-contained: `executeScript` sends this
 * function's source across, and anything it closed over would arrive
 * undefined.
 *
 * `innerText` rather than `textContent` because the extraction prompt is
 * written for what a person can read — `textContent` would hand the model the
 * contents of every hidden menu and template on the page, spending the
 * truncation budget before the Posting's own body is reached.
 */
function visibleText(): string {
  return document.body?.innerText ?? "";
}

/**
 * The tab the panel is open over. A side panel is one document per browser
 * window and is not itself a tab, so `currentWindow` is the window hosting
 * this panel. Chrome has been known to answer nothing for an extension
 * document that is not focused, which is why `lastFocusedWindow` stands behind
 * it rather than the call being made once and trusted.
 */
async function activeTab() {
  const [current] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (current !== undefined) return current;

  const [lastFocused] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return lastFocused;
}
