# 03: Context assembly — the two assemblers

**What to build:** The pure functions that turn rows already read into a
prompt, one per kind of Conversation. Implements ADR-0008. No provider call and
no endpoint here.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `apps/web/lib/conversations/context.ts` holds both assemblers, each a pure function from rows to a prompt — testable with no database and no provider
- [ ] The attached assembler sends: the Job Application's fields, its Posting description, its Requirements with Necessity and resolved Coverage, and its Analysis's Rating and Feedback where one exists
- [ ] Coverage is resolved with the existing resolution function that the badge and the fit ring already use. It is not re-implemented here — three readers of the precedence rule that can disagree is exactly what ADR-0004 was written to prevent
- [ ] The general assembler sends one line per Job Application — company, title, status, fit fraction, closing — with descriptions stripped
- [ ] Both send the Profile's CV text and accepted skill list
- [ ] Neither sends a Tailored CV's text. Where one is attached it is named as attached and nothing more (ADR-0004, ADR-0008)
- [ ] No tools, no function declarations, no query access is passed to the provider by either assembler, and nothing in this module reads a row it was not handed
- [ ] Text originating from a Posting — the description and the Requirements' wording — is fenced and labelled as quoted from a third-party website rather than as instruction
- [ ] The system instruction states what the model will not do: it advises and writes, and it does not set a Status, a Coverage or an attachment
- [ ] A missing Profile, a missing description and an absent Analysis each produce a prompt that says so plainly rather than an empty section
- [ ] A test asserts the general assembler's output contains no Posting description, because that is the boundary ADR-0008 turns on
