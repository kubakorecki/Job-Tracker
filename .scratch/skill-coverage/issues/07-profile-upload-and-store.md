# 07: The Profile — upload a CV, keep the file, extract the text

**What to build:** One master CV per user, stored as the file the user uploaded, with text extracted from it for the model to read. The file is the truth about the document: never edited, only replaced.

**Blocked by:** —

**Status:** done

- [x] A Profile is one row per user, keyed by user id — there is exactly one, and it cannot be duplicated
- [x] Uploading accepts PDF, Markdown and plain text, and refuses anything else with a message naming what is accepted
- [x] The uploaded file is stored byte-for-byte in a private Supabase Storage bucket and is never rewritten
- [x] Reading the Profile returns a short-lived signed URL for viewing and downloading the file
- [x] Text is extracted from the file by handing it to the model directly — no local PDF parsing library is added
- [x] The extracted text is stored beside the file reference, for an Analysis to read
- [x] Uploading again replaces the file and the extracted text, and the previous file is removed from storage
- [x] A file that cannot be read answers with a message telling the user to upload a cleaner copy, and leaves any existing Profile untouched
- [x] A user can only ever reach their own Profile
- [x] Tests substitute the reader and cover a good upload, a rejected media type, an unreadable file, a replacement, and tenant isolation

## Comments

Built as `apps/web/lib/profile/` — contract, reader, store, repository and the
two endpoints — with `POST` and `GET /api/profile` on top of them.

Two decisions worth naming, neither of them in the ticket:

**A Markdown or plain text CV is decoded, not sent to the model.** The ticket
says text is extracted "by handing it to the model directly"; that is what a
PDF gets, and it is what the no-parsing-library rule is about. A text file
already is its text, and a model asked to hand a document back verbatim can
only lose some of it, so `readCvWithGemini` decodes those two as UTF-8 and
reaches Gemini only for a PDF. Bytes that are not UTF-8 read as empty, which is
the same "upload a cleaner copy" answer a scan gets. `readingAsksTheModel` is
where that split lives.

**An upload spends one model call**, from the shared daily budget. Not in this
ticket's list — issue 08 asks for it — but `lib/model-calls/budget.ts` already
names "reading a CV" as one of the three things the allowance is for, and
shipping an unmetered endpoint that reaches Gemini would have contradicted it.
One call per upload rather than one per format: a text file costs nothing at
the provider today, and will cost the same one call as a PDF once its skills
are proposed.

The `skills` column exists on the `profiles` table and nothing writes it,
exactly as the Coverage columns on `requirements` did in issue 02 — so issue 08
adds the Draft that fills it without a migration of its own.

Setup, by hand and once per Supabase project (documented in
`docs/setup/supabase.md`): a private `cvs` bucket, and
`SUPABASE_SERVICE_ROLE_KEY` in the environment. Storage is the one part of
Supabase this app cannot reach as the database owner, so the service key is
what makes a private bucket reachable at all; `lib/profile/storage.ts` is the
only module that holds it, files every object under the owner's id, and refuses
a path that is not theirs.
