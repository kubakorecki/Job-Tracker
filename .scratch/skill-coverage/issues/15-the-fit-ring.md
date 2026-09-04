# 15: The fit ring on the board and the table

**What to build:** A glance across the whole pipeline that says where the user actually stands — a partially-filled ring with the fraction beside it, on every board card and every table row.

**Blocked by:** 11, 10

**Status:** ready-for-agent

- [ ] A ring on each board card and each table row, drawn from the fit fraction
- [ ] The fraction is shown as text beside the ring — "6 of 8" — so the meaning does not depend on telling red from green
- [ ] Colour runs red through amber to green across the ratio, as reinforcement rather than the only signal
- [ ] Only `required` Requirements count; `partial` counts for half
- [ ] A Job Application with no Requirements, or none marked `required`, shows no ring at all — an unknown fit must not read as a bad one
- [ ] The ring reads the same resolved Coverage the detail page does, so the two views cannot disagree
- [ ] A label says which Basis the ring reflects, so that the Tailored CV effort can change it without the meaning shifting silently
- [ ] Board and table use one shared component
