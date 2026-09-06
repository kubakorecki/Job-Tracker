# 04: A Posting states its own deadline

**What to build:** Reading the Closing Date off the page, and a box for it in the side panel's review form.

**Blocked by:** 01

**Status:** done

- [x] Extraction asks the model for the day applications close, as an ISO calendar date
- [x] Only a date the page actually states — never one worked out from "closes in 5 days" or from a posting date
- [x] A date the model words as anything but a calendar day is dropped rather than stored or sent on
- [x] The Draft carries it, the review form shows it in a date box, and saving sends it
- [x] The dashboard's add form takes one too, since a bookmark typed by hand is exactly when the user knows the deadline

## Comments

`closesOn` is one more flat string property on the extraction schema, and the
prompt gained a paragraph. The paragraph is mostly about what *not* to record:
a page saying "closes in 5 days" is stating a fact about when it was rendered,
and resolving it against the day of the extraction would store a deadline the
page never printed.

`readDraft` drops anything that is not a calendar day rather than passing it
on. That is not defensive tidiness — the review form holds this in a date box,
and a Draft carrying "in 5 days" would refuse to save with the user unable to
see what was in there. A dropped deadline costs the Draft one field; a kept bad
one costs it the save.

The side panel's review form gained a date box beside the Status, and the
dashboard's add form one too — a bookmark typed by hand is made at the moment
the user knows the deadline, and one recorded later is one they had to come
back for.
