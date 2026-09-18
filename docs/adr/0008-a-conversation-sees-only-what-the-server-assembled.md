# A Conversation sees only what the server assembled

Every turn of a Conversation is sent with its context already built: the model
is given no tools, no function declarations and no way to ask for a row it was
not handed. A Conversation attached to a Job Application is sent that Job
Application in full — its fields, its Posting description, its Requirements
with their Necessity and resolved Coverage, its Interviews, and its Analysis's
Rating and Feedback — plus the Profile's CV text and skill list. The general
Conversation is sent the Profile and a one-line outline of every Job
Application (company, title, status, fit fraction, closing, and the day of the
next Interview still standing) with the descriptions stripped, and never a
Posting's prose. The attached Tailored CV is named but its text is never
sent: the Profile is already there, and ADR-0004 has the two answering
different questions, which sending both invites the model to conflate.

The obvious alternative was tool calling — hand the model thin wrappers over
the repository functions and let it fetch what it decides it needs. It was
rejected for two reasons. The first is tenancy. ADR-0001 puts tenant isolation
entirely in application code and holds it there by making `user_id` a
non-optional argument on every repository function, with nothing building a
query inline. A tool schema the model fills in is a query the model composes,
and the only thing then keeping one user's rows away from another is the
model's good behaviour. Assembling above the call keeps the scoping exactly
where ADR-0001 put it. The second is that a Job Application's description is
text scraped from a stranger's website, and text from a stranger reaching a
model that holds tools is an instruction wearing data's clothes. With no tools
and no writes, the worst a hostile Posting achieves is telling the user
something they already own.

The cost argument came out the same way by accident. An outline is about thirty
tokens per Job Application, so two hundred of them is six thousand — less than
a single tool round trip, which spends a whole extra Model Call and resends the
conversation to use what it fetched.

**The Interviews need no fence.** Everything else in an attached prompt that
came from outside is fenced, because a Posting's description is text scraped
from a stranger's website. An Interview is not: the stage is the user's word
for the meeting and the notes are theirs about the employer, so it sits
unfenced exactly as the Job Application's own notes do. The one piece of it
that did come from the employer — the link out of the invitation — is left out
altogether. The model cannot open it and the user has it on their own page, so
its absence costs an answer nothing; that an online meeting is online is the
part that matters, and that is what is said.

## Consequences

The prompt is a pure function of rows the server already read, so what the
model was told is reproducible from the database and testable without a
provider. There is one assembly point per kind of Conversation and no other
path to the model.

The general Conversation cannot answer a question that needs one Job
Application's prose — "what exactly did the Vercel posting say about
on-call?" — and will say so rather than guess. The reply to that is to open the
Job Application and ask there, which is the surface the answer lives on. If
that proves too sharp an edge, the seam is a single named tool that opens one
Job Application in full, scoped by a `userId` closed over from the session and
absent from the tool's schema. It is deliberately not built.

An attached Conversation grows in cost with its Job Application's description,
which is the one unbounded field in the prompt.
