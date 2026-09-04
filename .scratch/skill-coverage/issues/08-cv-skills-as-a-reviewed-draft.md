# 08: The CV's skills as a Draft, reviewed and accepted

**What to build:** After an upload the model proposes a skill list. It is a Draft in the glossary's sense — shown for review, corrected, then accepted or discarded. Once accepted the list belongs to the user, who can edit it whenever they like.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Uploading a CV produces a proposed skill list, which is not persisted as the Profile's skills until the user accepts it
- [ ] The proposal has its own prompt and its own response schema, sharing nothing with job extraction but the provider boundary — the job extraction's instructions and property map are not reused or refactored together with it
- [ ] The user can add, edit and remove skills before accepting
- [ ] Discarding leaves any previously accepted skill list untouched
- [ ] Accepting replaces the Profile's skill list with what the user confirmed
- [ ] The accepted list is editable afterwards, independently of the file, and an edit does not touch the stored document
- [ ] Replacing the file proposes a fresh Draft, and the user chooses whether it replaces the accepted list or is discarded
- [ ] Reading a CV spends from the shared daily budget
- [ ] A provider failure and a spent budget each answer distinctly, and neither corrupts an existing Profile
- [ ] Tests substitute the reader and cover propose, correct, accept, discard, later edits, replacement, provider failure and exhausted budget
