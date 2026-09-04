# 07: The Profile — upload a CV, keep the file, extract the text

**What to build:** One master CV per user, stored as the file the user uploaded, with text extracted from it for the model to read. The file is the truth about the document: never edited, only replaced.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] A Profile is one row per user, keyed by user id — there is exactly one, and it cannot be duplicated
- [ ] Uploading accepts PDF, Markdown and plain text, and refuses anything else with a message naming what is accepted
- [ ] The uploaded file is stored byte-for-byte in a private Supabase Storage bucket and is never rewritten
- [ ] Reading the Profile returns a short-lived signed URL for viewing and downloading the file
- [ ] Text is extracted from the file by handing it to the model directly — no local PDF parsing library is added
- [ ] The extracted text is stored beside the file reference, for an Analysis to read
- [ ] Uploading again replaces the file and the extracted text, and the previous file is removed from storage
- [ ] A file that cannot be read answers with a message telling the user to upload a cleaner copy, and leaves any existing Profile untouched
- [ ] A user can only ever reach their own Profile
- [ ] Tests substitute the reader and cover a good upload, a rejected media type, an unreadable file, a replacement, and tenant isolation
