import { describe, expect, it } from "vitest";
import { problemsIn } from "./client";

/**
 * What a refused request amounts to, in the endpoint's own words. Every form
 * in the app renders this list, so what it leaves out is what the user is
 * never told.
 */

describe("problemsIn", () => {
  it("gives the endpoint's sentence for a refusal that named no fields", () => {
    expect(
      problemsIn({
        error:
          "You have used today's allowance of model calls. Try again tomorrow.",
      }),
    ).toEqual([
      "You have used today's allowance of model calls. Try again tomorrow.",
    ]);
  });

  it("gives the sentence and the fields, when the endpoint said both", () => {
    // The refusal of a CV in the wrong format is exactly this shape: the
    // sentence is what a CV may be, and the issue names the file that is not
    // one. A list holding only the second tells the user their file "is not
    // one of them" without ever saying what the ones are.
    expect(
      problemsIn({
        error: "A CV has to be a PDF, a Markdown file or a plain text file.",
        issues: ["resume.docx is not one of them."],
      }),
    ).toEqual([
      "A CV has to be a PDF, a Markdown file or a plain text file.",
      "resume.docx is not one of them.",
    ]);
  });

  it("keeps one line per offending field", () => {
    expect(
      problemsIn({
        error: "That Job Application is not valid.",
        issues: ["company: Required", "jobTitle: Required"],
      }),
    ).toEqual([
      "That Job Application is not valid.",
      "company: Required",
      "jobTitle: Required",
    ]);
  });

  it("says a thing once, however many ways the endpoint said it", () => {
    // The list is rendered keyed by its own text, and a sentence repeated as
    // its own issue is one problem the user has, not two.
    expect(
      problemsIn({ error: "Nothing doing.", issues: ["Nothing doing."] }),
    ).toEqual(["Nothing doing."]);
  });
});
