# Coverage has three readings and two Bases

One Requirement's Coverage is reached three ways — normalised comparison, which
is automatic and free; an Analysis, which the user triggers; and the user's own
override — in that ascending precedence. All three are kept side by side, as
`normalisedCoverage`, `analysedCoverage` and `overriddenCoverage` on one
Requirement, and the precedence is applied when a row is read rather than when
it is written. The alternative was one resolved Coverage column plus a
provenance enum recording which of the three last wrote it. It was rejected
because a single column can only remember the winner, and the losing readings
are the answer to the question a surprising badge provokes — the info
affordance has to say what the normalised comparison saw and what the Analysis
concluded, not merely that the user overrode something. Resolving at write time
also spreads the precedence rule across every write site, where it can be got
wrong once and never noticed, because the readings that would contradict it are
gone.

Every Coverage is measured against a Basis — the Profile, or the Tailored CV
attached to one Job Application — and both readings coexist for one
Requirement. Letting the Tailored CV's reading replace the Profile's was the
other alternative, and it was rejected because the Profile reading is what lets
the product say _you have this skill but left it off the CV you are sending_ —
the observation tailoring exists to produce, and the first thing a replacing
reading destroys. Superseding for display is not overwriting in storage: where
an interface has room for only one number, the Tailored CV's reading wins.

## Consequences

Resolving a Coverage is a pure function of a Requirement row: three readings go
in, one Coverage comes out. The same function serves the badge, the ring and
the API, so the three cannot disagree, and it is testable across every
combination of the three readings without a database.

Re-running an Analysis cannot destroy an override, because the only reading an
Analysis writes on a Requirement is the analysed one, and the override outranks
it. The user's last word is a property of how a row is read rather than a rule
each write site must remember to respect, and reverting an override is clearing
one reading — nothing has to be recomputed to restore what it hid.

Readings are recorded against the Basis they were measured for, so the Tailored
CV effort adds rows rather than migrating them; this effort only ever writes
`profile`. One Requirement can then hold a Profile reading and a Tailored CV
reading that disagree, which is the intended state here rather than a conflict
to reconcile. Staleness likewise stays a property of an Analysis run against
one Basis, derived by comparing when it ran against when the Requirements and
the CV it read last moved.
