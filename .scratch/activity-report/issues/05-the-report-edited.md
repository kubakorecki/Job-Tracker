# 05: The report, edited

**What to build:** The page where the user finishes the document.

**Status:** ready-for-agent

- [ ] Every cell editable; rows can be added and deleted, not reordered, with added rows last
- [ ] A free `Uwagi` block under the table
- [ ] Polish or English, chosen before generating: headings, the generator's wording and date formats translate, the user's own text does not. Switching regenerates after confirming
- [ ] Fewer than three rows warns, in the view only, and never blocks printing. Added rows count
- [ ] `localStorage` holds the name, the last language, and the draft per month and language; "Generate again" discards the draft. Nothing is sent to the server
- [ ] The name is typed once and remembered
