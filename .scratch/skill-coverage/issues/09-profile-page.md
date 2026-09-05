# 09: The Profile page

**What to build:** One page where the user uploads a CV, reviews the proposed skills, accepts them, sees and edits the accepted list, and views or downloads the document itself.

**Blocked by:** 08

**Status:** done

- [x] Lives under settings, beside Personal Access Tokens
- [x] Offers a file upload accepting PDF, Markdown and plain text
- [x] After upload, shows the proposed skills for review, editable, with accept and discard
- [x] Shows the accepted skill list, editable in place
- [x] Shows the uploaded document inline where the format allows, and offers a download
- [x] Offers replacing the CV by uploading another, and makes clear it replaces what is there
- [x] Has a first-run state that explains what the Profile is for, when none exists
- [x] Reports an unreadable file, a provider failure and a spent daily budget in plain language
- [x] Shows a pending state while a CV is being read, since the model call is not instant

## Comments

Built as `apps/web/app/settings/profile/` — the page, its loading and error
states, and one client component — on top of a new `lib/profile/client.ts` and
a `lib/profile/skill-edits.ts` that the page's list editing is tested through.
No new endpoint: issues 07 and 08 left three, and this ticket is the surface
over them.

Four decisions worth naming.

**The page holds the Profile, rather than re-reading the route.** Everywhere
else in this app a settings page renders the server's list and calls
`router.refresh()` after a change. That does not work here, because an upload
answers with two things — the Profile as it now stands and the Draft — and only
one of them has anywhere to be read back from. A refresh would fetch the half
the response already carried and could not fetch the other. So the page seeds
its state from the server on first render and owns it from there.

**The Draft lives in the page and nowhere else.** There is no accept endpoint
and no discard endpoint, which is issue 08's decision; the consequence here is
that "Discard them" is `setProposed(null)` and nothing more, and that the
accepted rows are deliberately not re-seeded when a replacement CV is uploaded.
Discarding leaves the accepted list untouched by construction rather than by a
rule the page has to keep — a user midway through correcting their skills who
uploads a new CV still is.

**One `SkillRows` for the proposal and for the accepted list, and one hook
behind both.** Correcting a Draft and editing what you accepted months ago are
the same gesture on the same shape, which is why one endpoint takes both; two
components rendering it would have been the same claim made twice.
`useSayingWhatTheListIs` is the request they share. What differs is only what
the user is being asked — accept or save — and the accepted list's "Nothing has
changed", which spends no request where clearing the last skill spends one and
empties the list.

**A Markdown or plain text CV is shown as its text, a PDF in a frame.** For
those two formats the extracted text _is_ the file decoded (issue 07), so there
is nothing else it could honestly be; a PDF's extracted text is the model's
transcription, and showing that as "your CV" would be showing a reading rather
than a document. Both links are the one signed URL, which lasts five minutes —
so there is a way to ask for a fresh one rather than a broken frame and no
explanation. The download link adds Storage's `download` parameter, which
`storage.ts` anticipated when it declined to bake one into the signature.

Three things the review caught and this change fixes, two of them outside the
page.

`problems()` in `lib/api/client.ts` did `failure.issues ?? [failure.error]`,
dropping the endpoint's own sentence whenever it had also named a field. The
refusal of a CV in the wrong format is exactly that shape, so a user uploading
a `.docx` was told "resume.docx is not one of them" and never what the ones
are — undoing issue 07's promise that a refusal names what is accepted. It is
now both halves, deduplicated, with `problemsIn` exported and tested.

`event.currentTarget` is null once a handler has awaited, and this handler
waits on a model call before resetting its form. The form is held before the
upload, as the tokens page holds its own.

`MAX_CV_BYTES`, `CV_FIELD` and the too-large refusal moved to `contract.ts`,
beside `ACCEPTED_CV_FORMATS`, so the page and the endpoint say one sentence for
one rule. `SECONDARY_BUTTON` moved into `app/form.tsx` for the same reason the
rest of that file exists: the Add button beside a list had been written out
twice.

Deliberately more than the list asks for, all of it small: a client-side size
check, so a body the platform would cut off is refused in words we wrote; a
link to open the document in a tab, which for a Markdown or plain text CV is
the only way to see the stored file rather than its decoding; and the button
that mints fresh links when the signed ones have expired.

Nothing was added to `CONTEXT.md`. The page introduces no vocabulary — Profile,
Draft and Skill were all defined by issues 07 and 08, and this is the first
place a user can see them.
