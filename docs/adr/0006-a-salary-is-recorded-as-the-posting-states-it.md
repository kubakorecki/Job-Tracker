# A salary is recorded as the Posting states it

Extraction records a salary in the period the Posting quotes it over, carried
beside the bounds as a Salary Period, and never converts it. Where a Posting
states several salaries for one role, the recorded range is the widest span
they cover together.

The extraction prompt used to ask for annual figures and to leave the salary
empty unless the page printed an annual equivalent itself. That is most of the
Polish market gone: pracuj.pl quotes monthly, so every Posting from it lost its
salary silently — the model was obeying the prompt, and an empty field is
indistinguishable from a page that named no money.

Annualising instead would have been arithmetic on top of what the Posting said.
The multiplier is a guess — twelve months or thirteen, how many billable days
in a contractor's year — and once stored, the guess is indistinguishable from
the Posting's own words. A user who reads `204000 PLN` cannot tell whether the
page said that or whether we multiplied.

## Consequences

Two Job Applications are only comparable once their periods agree, so anything
that sorts or filters on a salary has to read the period beside it. Nothing
does yet: salary is edited and displayed, never ranked. The day something
ranks salaries, the conversion belongs there — at the point of comparison,
where the assumption is visible and revisable — and not in the stored row.

The widest span is deliberately not the same claim as any one contract's range.
A Posting offering 17 000–21 650 gross on an employment contract beside
20 870–26 090 net on B2B is recorded as 17 000–26 090: what the role could pay,
across the arrangements on offer. The alternative — picking one contract type —
would need a Contract Type in the domain to say which was picked, and the user
can already narrow the range by hand in the review form.
