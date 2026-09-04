# 09: The Profile page

**What to build:** One page where the user uploads a CV, reviews the proposed skills, accepts them, sees and edits the accepted list, and views or downloads the document itself.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Lives under settings, beside Personal Access Tokens
- [ ] Offers a file upload accepting PDF, Markdown and plain text
- [ ] After upload, shows the proposed skills for review, editable, with accept and discard
- [ ] Shows the accepted skill list, editable in place
- [ ] Shows the uploaded document inline where the format allows, and offers a download
- [ ] Offers replacing the CV by uploading another, and makes clear it replaces what is there
- [ ] Has a first-run state that explains what the Profile is for, when none exists
- [ ] Reports an unreadable file, a provider failure and a spent daily budget in plain language
- [ ] Shows a pending state while a CV is being read, since the model call is not instant
