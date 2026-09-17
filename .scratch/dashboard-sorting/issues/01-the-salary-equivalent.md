# 01: The Salary Equivalent

**What to build:** The arithmetic and the wording, as a pure module beside
`closing.ts` and `silence.ts` in `apps/web/lib/job-applications/`. Nothing in
the interface yet. See the spec's "The short form of a salary".

**Status:** done

- [x] One fixed working year, named once: 12 months, 260 days, 2080 hours
- [x] A Job Application's salary restated over a chosen Salary Period — both bounds, either of which may be null — and whether the arithmetic changed it (stated period ≠ chosen period)
- [x] No salary at all (both bounds null) has no Salary Equivalent, rather than one of zero
- [x] A bound recorded without a period is treated as no salary, since a bare figure means nothing (ADR-0006)
- [x] The ranking value: the middle of the restated range, or the one bound there is
- [x] The short form, per the spec's table: `k` at or above 10 000 with at most one decimal, whole numbers below, each bound formatted on its own, `from` / `up to` for a single bound, currency omitted when null, suffixes `yr` / `mo` / `day` / `h`, `≈` only when the figure was changed
- [x] The hover text: the stated figure in full with its `SALARY_PERIOD_LABELS` wording, then the working-year rule
- [x] Unit tests cover every period pair, single bounds, no currency, the 10 000 threshold on each side, rounding to one decimal (`26 090` → `26.1k`), and a figure left unchanged when the periods agree

## Comments

Built as `apps/web/lib/job-applications/salary-equivalent.ts`, beside
`closing.ts`: `WORKING_YEAR`, `salaryEquivalentOf`, `salaryRankOf`,
`salaryLabel` and `salaryDescription`, with 36 tests.

Decisions worth naming for issues 02 and 03.

**The label does not carry the `≈`.** `SalaryEquivalent.approximate` says
whether to draw it; issue 02 draws the mark as its own element so the hover
text (`salaryDescription`) hangs off it.

**The bounds are a union with at least one present** (`SalaryBounds`). A
salary with neither never becomes a Salary Equivalent, so `salaryRankOf` and
the label have no empty case to invent a zero for.

**Wording.** The hover text follows `SALARY_PERIOD_LABELS` after "per" —
`Stated as 150–180 PLN per hour · restated on a year of 12 months, 260 days,
2080 hours` — and leaves out the working-year rule when nothing was restated.
Two bounds at or above 10k share one `k` (`17–26.1k`); otherwise each carries
its own form (`9999–10k`). Bounds that round to the same short form are
written as one figure.

**Left for later.** `salaryDescription`'s stated-salary wording repeats
`salarySays` in `lib/conversations/context.ts`; one shared wording would stop
them drifting, but it would change the Conversation module, which this issue
does not touch.

