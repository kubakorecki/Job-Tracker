# Two limits for two reasons

The product keeps two limits on model spending and shows the user only one of
them. **AI Usage** is a monthly token count — every token the provider reports
for a call, thinking included — metered against a monthly limit, drawn on the
Profile, and the only measure of cost anything in the interface names. The
daily **Model Call** count stays exactly as it was, at a raised ceiling, and
becomes plumbing nobody is told about.

Collapsing the two was the alternative, and it does not work in either
direction. A monthly token limit cannot do the daily count's job: that count
exists so a leaked Personal Access Token cannot drain the grant before the user
notices and revokes it, and a token limit generous enough for a month of honest
use is a token limit a stolen credential empties in an afternoon. The daily
count cannot do the token limit's job either, because a Conversation turn and a
CV reading are the same thing to it and wildly different amounts of money —
which was tolerable while every call was one shot and roughly one size, and
stopped being tolerable the moment a feature arrived that spends twenty calls
answering one question.

So there are two, named separately in `CONTEXT.md` on purpose. One word for
both would be a token meter called a call count, and the first reader to notice
the daily cap looks redundant would delete the thing that caps the blast
radius.

## Consequences

A turn is admitted on the budget it has before it starts, not the budget it
will have when it ends: a streamed reply cannot be priced until its last chunk
arrives, so a turn that begins within the limit is allowed to finish and
overshoot. The overshoot is one turn's worth, and the alternative is killing a
half-written cover letter mid-sentence over an accounting boundary.

Usage is recorded from the final chunk's `usageMetadata`. A call that fails
before the provider answers records nothing, and still spends its Model Call —
the daily count is deliberately charged before the provider is reached, which
is the existing rule in `spendModelCall` and the reason it is written that way.

Two limits means two refusals, and they do not read the same. A spent AI Usage
allowance says the month is done and shows the meter. A hit Model Call ceiling
is the one the user should never see, so if it ever surfaces it means something
is wrong — a runaway client or a leaked token — and it says so rather than
inviting them to wait.
