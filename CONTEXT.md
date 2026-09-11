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
Posting or from nothing at all (a referral, a recruiter email). It was the only
aggregate v1 persisted, which is the shape ADR-0001 was written against; a
Conversation is the second.
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

**Salary Period**:
The stretch of time a salary figure is a rate over: annual, monthly, daily or
hourly. Recorded beside the two bounds because a Posting quotes over whatever
its market quotes in — annual in the UK, monthly across Poland, hourly for
contract work — and a bare figure means nothing without it. A Posting's own
period is kept as stated and never converted (ADR-0006).
_Avoid_: frequency, interval, per, cadence

**Excitement**:
How much the user wants one Job Application, nought to five. Their own opinion
and nothing the model or the pipeline has a say in — it is never read off a
Posting, never inferred, and means nothing beyond what the user meant by it.
Nought is a rating rather than a blank: it is where every Job Application
starts.
_Avoid_: rating, score, priority, interest

**Closing Date**:
The day a Posting stops accepting applications, as the Posting states it. A
calendar day rather than an instant, because that is what a Posting states and
a time of day would be our invention (ADR-0007). Null wherever the Posting
named none, or there is no Posting to name one.
_Avoid_: deadline, expiry, valid until, end date

**Closing**:
What a Closing Date amounts to today, given where the Job Application sits:
`open`, `closing-soon`, `missed` or `closed`. Only a bookmarked Job Application
can be hurried or can have missed anything — a Closing Date on one already
applied for asks nothing of the user. Once past, on a Job Application that was applied
for, it is the day the employer stopped collecting candidates, and how long ago
that was is what says whether silence still means nothing (ADR-0007).
_Avoid_: urgency, expiry state, freshness

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
Requirement, and one overall Rating and its Feedback for the run as a whole.
Stored, and marked stale when the Requirements or the CV it was measured
against move underneath it.
_Avoid_: comparison, evaluation, check, scan

**Rating**:
An Analysis's own verdict on the run as a whole, read as an HR screener would:
an integer from 1 to 10 for how likely the CV is to earn an interview for the
Posting. It is a different number from the Fit Fraction above — the Fraction
counts Requirements met and is free and automatic; the Rating is the model's
judgement of the whole application and costs the Model Call an Analysis
already spends. Its Feedback is the one paragraph, alongside it, on what would
raise it. Both are stored on the Analysis, not on any one Requirement, and
both are replaced whole by a re-run.
_Avoid_: score, interview probability

**Tailored CV**:
The one CV attached to one Job Application — generated from the Profile or
uploaded by hand, and sent when the user records that it was. While none is
attached, the Profile stands in as what would be sent.
_Avoid_: application CV, attachment, resume, document

**Conversation**:
A record of the user talking to the model about their job search, kept so it
can be returned to. There are two kinds and no more: one attached to a Job
Application, which sees that Job Application and nothing else, and one
unattached general Conversation, which sees every Job Application in outline
and none in full. Both always see the Profile. Clearing one destroys its
Messages; there is never a second Conversation of the same kind to choose
between, so a Conversation is found by standing somewhere rather than by
picking it off a list. Nothing marks one stale — every turn is assembled from
the state of that moment, and what was said stands as a record of a
conversation that happened rather than a claim still being made.
_Avoid_: chat, thread, session, history

**Message**:
One thing said in a Conversation, by the user or by the model. The model's are
prose and nothing else: there is no Draft here and nothing a Message becomes.
A cover letter is a Message the user reads and copies out, not a document the
product stores a second time under another name.
_Avoid_: turn, exchange, reply, completion

**Model Call**:
One call to the model, on the user's behalf and against the one API key:
reading a Posting, reading a CV, running an Analysis, or answering one turn of
a Conversation. All of them spend from a single daily count per user, because
it is one grant and the reason for the limit is indifferent to which call
drained it. That count exists to cap what a leaked Personal Access Token can
spend in a day and for nothing else — what a user has spent is AI Usage's
business, and a Model Call is never shown to anyone (ADR-0009). The table that
counts them is still `extraction_usage`, from when extraction was the only
kind.
_Avoid_: extraction (for the counter), request, generation, token

**AI Usage**:
What one user has spent on the model this month, counted in tokens — every
token the provider reports for a call, the model's own thinking included —
summed across reading a Posting, reading a CV, an Analysis and every
Conversation turn alike. It is the only measure of cost the product shows, it
is metered against a monthly limit, and it is drawn on the Profile. A Model
Call is the other limit and answers a different question (ADR-0009).
_Avoid_: quota, credits, allowance, budget

**Personal Access Token**:
A long-lived credential the user generates in the dashboard and pastes into the
extension, standing in for the session cookie the extension cannot have. Shown
once; only its hash is kept.
_Avoid_: API key, access key, auth token
