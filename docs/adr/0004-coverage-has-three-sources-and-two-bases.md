# Coverage has three sources and two Bases

One Requirement's Coverage is reached three ways — normalised comparison, which
is automatic and free; an Analysis, which the user triggers; and the user's own
override — in that ascending precedence. All three readings are kept side by
side and the precedence is applied when a row is read, not when it is written.
The obvious alternative is one resolved Coverage column plus a provenance enum
recording which source last wrote it. It was rejected because a single column
can only remember the winner, and the losing readings are the answer to the
question a surprising badge provokes: the info affordance has to be able to say
what the normalised comparison saw and what the Analysis concluded, not merely
that the user overrode something. A write-time resolution also spreads the
precedence rule across every write site, where it can be got wrong once and
never noticed, because the readings that would contradict it were overwritten.

Every Coverage is measured against a Basis — the Profile, or the Tailored CV
attached to one Job Application — and both readings coexist for one Requirement
rather than the second replacing the first, which was the other alternative
rejected here. They answer two different questions: "do I have this?" against
the Profile, and "does what I am sending show it?" against the Tailored CV.
Keeping the Profile reading after a Tailored CV exists is what lets the product
say _you have this skill but left it off the CV you are sending_ — the
observation tailoring exists to produce, and the one thing a replacing reading
would destroy. Where an interface has room for only one number the Tailored
CV's reading supersedes the Profile's, but superseding for display is not
overwriting in storage.

## Consequences

Resolving a Coverage is a pure function of a Requirement row: the three
readings go in, one Coverage comes out. The same function serves the badge, the
fit ring and the API, so the three cannot disagree, and it is testable across
every combination of the three sources without a database.

Re-running an Analysis cannot destroy an override, because an Analysis writes
only the analysed reading and the override outranks it. The user's last word is
a property of how a row is read rather than a rule each write site has to
remember to respect. Reverting an override is clearing one reading, after which
the Requirement falls back to whatever the Analysis or the normalised
comparison said — nothing has to be recomputed to restore it.

The readings are stored per Basis, so the Tailored CV effort adds rows rather
than migrating them; this effort writes only `profile`. The cost is that a
Requirement can carry six readings at once, and any interface showing one must
say which Basis it is showing. Staleness stays a property of an Analysis run
against one Basis, not of a Requirement, and is derived by comparing when that
run happened against when the Requirements and the CV it read last moved.
