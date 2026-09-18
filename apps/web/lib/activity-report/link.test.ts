import { describe, expect, it } from "vitest";
import { linkHref, shortLink } from "./link";

/**
 * What a cell does with the Posting's address: shorten it for the paper, and
 * keep it whole for the PDF.
 */

describe("linkHref", () => {
  it("is the address itself, untouched, where the text is one", () => {
    expect(linkHref("https://example.com/jobs/42")).toBe(
      "https://example.com/jobs/42",
    );
  });

  it("takes the spaces off a box somebody pasted into", () => {
    expect(linkHref("  https://example.com/jobs/42  ")).toBe(
      "https://example.com/jobs/42",
    );
  });

  it("is nothing at all where the cell holds something else", () => {
    expect(linkHref("")).toBeNull();
    expect(linkHref("   ")).toBeNull();
    expect(linkHref("przez znajomego")).toBeNull();
    expect(linkHref("example.com/jobs/42")).toBeNull();
  });

  it("makes nothing clickable but a page on the web", () => {
    expect(linkHref("mailto:recruiter@example.com")).toBeNull();
    expect(linkHref("javascript:alert(1)")).toBeNull();
  });
});

describe("shortLink", () => {
  it("drops the scheme, the www and the trailing slash", () => {
    expect(shortLink("https://www.example.com/jobs/")).toBe("example.com/jobs");
  });

  it("leaves a link a column has room for alone", () => {
    expect(shortLink("https://example.com/jobs/senior-engineer")).toBe(
      "example.com/jobs/senior-engineer",
    );
  });

  it("drops a tracking query, which says nothing about the job", () => {
    expect(
      shortLink("https://example.com/jobs/42?sug=sr_top&utm_source=board"),
    ).toBe("example.com/jobs/42");
  });

  it("keeps a query where it is all there is to identify a Posting by", () => {
    expect(shortLink("https://example.com/?oferta=1002345")).toBe(
      "example.com?oferta=1002345",
    );
  });

  it("keeps the host and the job, and takes out the middle", () => {
    const shortened = shortLink(
      "https://pracuj.pl/praca/senior-typescript-engineer-warszawa,oferta,1002345?sug=sr_top&utm_source=board",
    );

    expect(shortened.startsWith("pracuj.pl…")).toBe(true);
    expect(shortened.endsWith("oferta,1002345")).toBe(true);
    expect(shortened.length).toBeLessThanOrEqual(44);
  });

  it("cuts where the room ends when the host has taken the whole cell", () => {
    const shortened = shortLink(
      "https://careers.some-very-long-department.example.com/openings/42",
    );

    expect(shortened.length).toBeLessThanOrEqual(44);
    expect(shortened.endsWith("…")).toBe(true);
    expect(shortened.startsWith("careers.some-very-long-department")).toBe(
      true,
    );
  });

  it("prints text that is not an address as the text it is", () => {
    expect(shortLink("  przez znajomego ")).toBe("przez znajomego");
    expect(shortLink("")).toBe("");
  });
});
