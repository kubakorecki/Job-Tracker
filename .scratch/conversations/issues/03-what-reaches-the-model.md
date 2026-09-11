# 03: Context assembly — the two assemblers

**What to build:** The pure functions that turn rows already read into a
prompt, one per kind of Conversation. Implements ADR-0008. No provider call and
no endpoint here.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] `apps/web/lib/conversations/context.ts` holds both assemblers, each a pure function from rows to a prompt — testable with no database and no provider
- [x] The attached assembler sends: the Job Application's fields, its Posting description, its Requirements with Necessity and resolved Coverage, and its Analysis's Rating and Feedback where one exists
- [x] Coverage is resolved with the existing resolution function that the badge and the fit ring already use. It is not re-implemented here — three readers of the precedence rule that can disagree is exactly what ADR-0004 was written to prevent
- [x] The general assembler sends one line per Job Application — company, title, status, fit fraction, closing — with descriptions stripped
- [x] Both send the Profile's CV text and accepted skill list
- [x] Neither sends a Tailored CV's text. Where one is attached it is named as attached and nothing more (ADR-0004, ADR-0008)
- [x] No tools, no function declarations, no query access is passed to the provider by either assembler, and nothing in this module reads a row it was not handed
- [x] Text originating from a Posting — the description and the Requirements' wording — is fenced and labelled as quoted from a third-party website rather than as instruction
- [x] The system instruction states what the model will not do: it advises and writes, and it does not set a Status, a Coverage or an attachment
- [x] A missing Profile, a missing description and an absent Analysis each produce a prompt that says so plainly rather than an empty section
- [x] A test asserts the general assembler's output contains no Posting description, because that is the boundary ADR-0008 turns on

## Comments

Implemented on `feat/chat`. Both assemblers are
`apps/web/lib/conversations/context.ts` — `attachedPrompt` and `generalPrompt`,
each a pure function from rows to the system instruction a turn is sent with,
covered by `context.test.ts` with no database and no provider.

Coverage is resolved through `resolvedCoverage` from `lib/coverage/compare.ts`,
the same function the badge and the fit ring read by, and the general outline's
fit fraction through `fitFractionOf` and `fitLabel`. The Closing is
`closingOf`/`closingLabel` rather than a bare date, so what the model is told a
Closing Date means is what the badge says it means.

`OutlinedJobApplication` has no `description` field at all, so the general
assembler cannot send a Posting's prose even by mistake; the Tailored CV
arrives as `AttachedTailoredCv`, a name and nothing else, for the same reason.
The test that asserts a whole Job Application, description and all, produces an
outline with none of it is `generalPrompt > sends no Posting description`.

Three things came out of the review and are worth recording. The fence carries
its label per block rather than once, because a Requirement line is a
stranger's words with this tracker's Coverage appended and one label covering
both blocks would have to be untrue of one of them. A Posting's own text has
any forged marker taken out of it before it is fenced, so a description that
contains the closing marker cannot end the fence early. And the Coverage names
the Basis it was measured against (ADR-0004) — the Profile, which is the only
Basis anything reads yet — because a Tailored CV is named two sections below
it.
