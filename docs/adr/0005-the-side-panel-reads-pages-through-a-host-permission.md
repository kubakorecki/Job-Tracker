# The side panel reads pages through a host permission

The extension is a side panel, and Chrome never grants `activeTab` to one.
Opening the panel from the toolbar icon was judged too weak a signal of intent
to grant it, and a click inside the panel is not the gesture either — the panel
is an extension document, not the page ([crbug/336592430]). This is a decision,
not a defect awaiting a fix.

So the panel's original permissions — `activeTab` and `scripting`, and no host
permission — could never read a page. Every "Save this job" landed on the
unreadable path, and its message named a remedy (re-open the panel from the
toolbar icon) that could not work. `tab.url` was invisible for the same reason,
which silently disabled ADR-0002's already-saved lookup in any packed build; it
worked in development only because WXT injects `tabs` there.

The manifest therefore asks for `http://*/*` and `https://*/*` up front, and
`activeTab` is gone: alongside a host permission it grants nothing, and keeping
it would suggest the panel had a narrower fallback than it has.

## Consequences

Chrome shows "Read and change all your data on all websites" at install. That
is the honest description — a Posting can be advertised anywhere, so the set of
pages the panel may be opened over is the web — but it is the strongest warning
the store displays, and it is the price of the side panel as the surface.

We considered `optional_host_permissions` granted from a button in the panel,
which avoids the install-time warning and lets the user revoke access. It was
rejected for v1 as a worse first run: the user's first "Save this job" would
answer with a permission prompt rather than a Draft. The seam is small if we
change our minds — the manifest and the `permissions.contains()` check the panel
would need in front of `readActivePosting`.

Standing access is not standing reading. The panel injects once per click, never
on open, and holds no content script (`apps/extension/lib/page.ts`) — extraction
spends a share of a daily grant, so a panel that read every tab it was opened
over would spend it on pages nobody asked about. What the permission changed is
what Chrome allows, not when the panel asks.

Chrome's own pages, the Web Store, the PDF viewer and `file://` URLs stay
unreadable to any extension. Those remain an ordinary outcome, answered with the
review form and an explanation — now one that names manual entry as the remedy,
since nothing the user can do makes such a tab readable.

[crbug/336592430]: https://issues.chromium.org/issues/336592430
