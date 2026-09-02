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
A partially-filled Job Application proposed by the extraction step and shown to
the user for review. Never persisted — it either becomes a Job Application when
the user saves it, or is discarded.
_Avoid_: extraction, suggestion, candidate

**Personal Access Token**:
A long-lived credential the user generates in the dashboard and pastes into the
extension, standing in for the session cookie the extension cannot have. Shown
once; only its hash is kept.
_Avoid_: API key, access key, auth token
