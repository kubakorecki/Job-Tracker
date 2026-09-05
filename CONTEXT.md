# Job Tracker

A personal tracker for job applications, fed both by hand through a web
dashboard and automatically by a browser extension that reads the job posting
you are looking at.

## Language

**Posting**:
A job advertisement as it exists on the web, at a URL. Lives on someone else's
site; we never own it.
_Avoid_: listing, ad, job

**Job Application**:
The record we keep of one job the user is pursuing. It may originate from a
Posting or from nothing at all (a referral, a recruiter email). This is the
only aggregate v1 persists.
_Avoid_: job, application, entry, card

**Status**:
Where a Job Application sits in the user's pipeline: bookmarked, applied,
interviewing, offer, rejected, withdrawn. Set by the user, never inferred.
_Avoid_: stage, state, phase

**Draft**:
Something the model proposes and the user reviews before it becomes real. Never
persisted as itself — it becomes the thing it proposes when the user accepts
it, or is discarded. There are two: a partially-filled Job Application read from
a Posting, and a skill list read from an uploaded CV. They share this pattern
and nothing else — each has its own prompt and its own shape.
_Avoid_: extraction, suggestion, candidate

**Profile**:
The user's own side of the comparison: one master CV per user. Two things with
two different owners — the uploaded file, which is the truth about the document
and is never edited, only replaced; and a skill list, first proposed by the
model as a Draft and thereafter owned and freely edited by the user. Text
extracted from the file sits beside it, so that an Analysis has prose to read.
_Avoid_: resume, master document, user record

**Skill**:
One thing a person can do, worded as they word it — a technology, a practice, a
qualification, a language. The Profile holds a list of them, proposed by the
model as a Draft and thereafter the user's own to edit. There is no vocabulary
and no taxonomy behind the word: a Requirement names what a Posting asked for
in its own words, a Skill names what the user has in theirs, and Coverage is
what comes of comparing the two.
_Avoid_: competency, tag, keyword, ability

**Requirement**:
One thing a Posting asks of a candidate — a technology, a practice, a
qualification, a language, a quantity of experience. Carries a Necessity.
Replaces the flat `keywords` list, which could not say whether the Posting
insisted on something or merely liked it.
_Avoid_: keyword, tag, criterion

**Necessity**:
How badly a Posting wants a Requirement: required, preferred, or unstated.
Read from the Posting's own wording — `unstated` is what a Posting that lists
a skill without saying which it is gets, so that nothing is guessed upward.
_Avoid_: priority, importance, level, weight

**Coverage**:
How well a CV answers one Requirement: have, partial, or missing. Always
measured against a stated Basis, and reached three ways, in ascending
precedence — normalised comparison (automatic, always), Analysis (the model, on
request), and the user's own override. All three are kept, so the user can see
why a Requirement reads the way it does; only the highest-precedence one is the
Coverage.
_Avoid_: match, gap, fit, score

**Basis**:
Which CV a Coverage was measured against: the Profile, or the Tailored CV. Both
readings may exist for one Requirement and both stay visible, because they
answer different questions — "do I have this?" and "does what I am sending show
it?". Where only one number fits, the Tailored CV's reading supersedes the
Profile's.
_Avoid_: source, target, subject

**Fit Fraction**:
How much of what one Posting insists on the user has: its `required`
Requirements counted against how many of them their Coverage answers, `have` as
one and `partial` as a half. Preferred and unstated Requirements are not in it,
so a long list of nice-to-haves cannot drag down a job the user suits. A Job
Application that insists on nothing, or whose Requirements nothing has read yet,
has no Fit Fraction at all — an unknown fit is not a bad one. It is what the fit
ring on a board card and a table row draws.
_Avoid_: score, match percentage, rating, strength

**Analysis**:
The model's reading of a Posting's Requirements against one Basis, run only
when the user asks for it, producing a Coverage and a one-line reason for each
Requirement. Stored, and marked stale when the Requirements or the CV it was
measured against move underneath it.
_Avoid_: comparison, evaluation, check, scan

**Tailored CV**:
The one CV attached to one Job Application — generated from the Profile or
uploaded by hand, and sent when the user records that it was. While none is
attached, the Profile stands in as what would be sent.
_Avoid_: application CV, attachment, resume, document

**Model Call**:
One call to the model, on the user's behalf and against the one API key:
reading a Posting, reading a CV, or running an Analysis. All three spend from a
single daily allowance per user, because it is one grant and the reason for
the limit is indifferent to which call drained it. The table that counts them
is still `extraction_usage`, from when extraction was the only kind.
_Avoid_: extraction (for the counter), request, generation, token

**Personal Access Token**:
A long-lived credential the user generates in the dashboard and pastes into the
extension, standing in for the session cookie the extension cannot have. Shown
once; only its hash is kept.
_Avoid_: API key, access key, auth token
