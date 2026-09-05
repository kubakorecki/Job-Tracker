# 08: The CV's skills as a Draft, reviewed and accepted

**What to build:** After an upload the model proposes a skill list. It is a Draft in the glossary's sense — shown for review, corrected, then accepted or discarded. Once accepted the list belongs to the user, who can edit it whenever they like.

**Blocked by:** 07

**Status:** done

- [x] Uploading a CV produces a proposed skill list, which is not persisted as the Profile's skills until the user accepts it
- [x] The proposal has its own prompt and its own response schema, sharing nothing with job extraction but the provider boundary — the job extraction's instructions and property map are not reused or refactored together with it
- [x] The user can add, edit and remove skills before accepting
- [x] Discarding leaves any previously accepted skill list untouched
- [x] Accepting replaces the Profile's skill list with what the user confirmed
- [x] The accepted list is editable afterwards, independently of the file, and an edit does not touch the stored document
- [x] Replacing the file proposes a fresh Draft, and the user chooses whether it replaces the accepted list or is discarded
- [x] Reading a CV spends from the shared daily budget
- [x] A provider failure and a spent budget each answer distinctly, and neither corrupts an existing Profile
- [x] Tests substitute the reader and cover propose, correct, accept, discard, later edits, replacement, provider failure and exhausted budget

## Comments

Built in `apps/web/lib/profile/` — the reader, the contract, a new pure
`skills.ts`, the repository and the endpoints — with `PUT /api/profile/skills`
added beside the two that were already there. No migration: the `skills` column
issue 07 left empty is the one this fills.

Four decisions worth naming.

**Accepting a Draft and editing the list are one request.** There is no accept
endpoint. The user reviews a proposal, corrects it, and sends back what the
list should be — which is exactly what an edit three weeks later does, since
the list they accept may be one they rewrote entirely. A separate `accept`
would have taken the same body, done the same write, and drifted from the edit
it is indistinguishable from. Discarding needs no endpoint at all: nothing
persisted the proposal, so a discarded Draft is one the client stopped holding.
That is what makes "discarding leaves the accepted list untouched" true by
construction rather than by a rule someone has to keep.

**The upload answers with `{ profile, proposedSkills }`.** Its response was a
bare `Profile` before this. The two sit side by side rather than merged because
they have different owners and different lifetimes: `profile.skills` is
whatever the user last accepted — untouched by this upload — and
`proposedSkills` is the Draft. A replacement upload therefore shows the user
both lists at once, which is the whole of "the user chooses whether it replaces
the accepted list or is discarded".

**One model call still reads a CV, and it now reads both halves.** `ReadCv`
answers with `{ text, skills }` instead of a string. A PDF is transcribed and
its skills proposed in one reply; a Markdown or plain text file is decoded
locally as before, and the one call asks only for the skills — so the reader
holds two instruction strings and two response schemas, sharing the skills
paragraph and the skills property between them, and nothing at all with job
extraction. Asking twice would have spent two of the user's daily allowance to
read a document that only has to be read once, and issue 07 had already said an
upload costs one call whatever format it arrives in. `readingAsksTheModel` is
now `textComesFromTheModel`: the model is asked about every upload, and only the
transcription is a question a text file has already answered.

**Tidying is one function, used on both lists.** `tidySkills` trims, collapses
inner whitespace, drops blanks, drops a skill that differs from an earlier one
only in case, and caps the list. The model's proposal and the user's own edit
both go through it, so a proposal cannot show something the accepted list would
have dropped. It also drops anything the contract would not call a
Skill at all, so the list shown for review is one the accept request cannot be
refused for. Nothing further is folded together — "Node" and "Node.js" stay two
skills, because the spec puts no alias table and no taxonomy anywhere in this
product and leaves the Analysis as the escape hatch for what a comparison
cannot see; a tidier that guessed would quietly lose a skill the user typed on
purpose.

The list cap (`SKILL_LIST_LIMIT`, 100) is a contract rule, so an over-long list
is a 400 with issues naming the field; the caps inside `tidySkills` are only
ever reached by the model, which is asked for 30 skills. A skill list sent by a
user with no Profile is a 404 rather than a quietly created row: a list with no
document behind it is not something an Analysis could ever measure against.

`CONTEXT.md` gained a **Skill** entry. The word now carries real rules of its
own — what may be in a list, how many, and that two spellings differing only in
case are one — and the glossary had it only as a phrase inside **Profile**.

Two things the review caught and this change fixes. A transcription reply whose
text was missing used to fall back to an empty string, which the endpoint reads
as "this document holds no text" — so a provider that answered nonsense would
have been reported as the user's file needing a cleaner export. `TranscriptReply`
therefore does not let the text fall back, while the skill list still does: an
empty proposal is a reading the user can correct, and a failed upload is not.
And `tidySkills` now enforces the contract's own `Skill` rule rather than only
the list's length, so an over-long proposal is dropped before the user is shown
a list they could not have accepted.

The Profile page (issue 09) is what puts a review in front of the user; until
it exists the Draft is reachable only through the API.
