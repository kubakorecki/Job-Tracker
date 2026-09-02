import { describe, expect, it } from "vitest";
import { normalizeJobUrl } from "./normalize-job-url.js";

describe("normalizeJobUrl", () => {
  it("lowercases the host", () => {
    expect(normalizeJobUrl("https://WWW.Example.COM/jobs/1")).toBe(
      "https://www.example.com/jobs/1",
    );
  });

  it("leaves the path's case alone", () => {
    expect(normalizeJobUrl("https://example.com/Jobs/AbC")).toBe(
      "https://example.com/Jobs/AbC",
    );
  });

  it("drops the fragment", () => {
    expect(normalizeJobUrl("https://example.com/jobs/1#apply-now")).toBe(
      "https://example.com/jobs/1",
    );
  });

  it("strips utm_ parameters", () => {
    expect(
      normalizeJobUrl(
        "https://example.com/jobs/1?utm_source=li&utm_medium=social&id=5",
      ),
    ).toBe("https://example.com/jobs/1?id=5");
  });

  it("strips ref parameters", () => {
    expect(
      normalizeJobUrl("https://example.com/jobs/1?ref=abc&refId=9&id=5"),
    ).toBe("https://example.com/jobs/1?id=5");
  });

  it("strips trackingId and gh_src", () => {
    expect(
      normalizeJobUrl(
        "https://example.com/jobs/1?trackingId=xyz&gh_src=q&id=5",
      ),
    ).toBe("https://example.com/jobs/1?id=5");
  });

  it("matches tracking parameter names case-insensitively", () => {
    expect(
      normalizeJobUrl(
        "https://example.com/jobs/1?UTM_Source=li&TrackingID=x&id=5",
      ),
    ).toBe("https://example.com/jobs/1?id=5");
  });

  it("keeps a parameter that merely contains a tracking name", () => {
    expect(normalizeJobUrl("https://example.com/jobs/1?preference=ref")).toBe(
      "https://example.com/jobs/1?preference=ref",
    );
  });

  it("sorts the remaining parameters", () => {
    expect(normalizeJobUrl("https://example.com/jobs?c=3&a=1&b=2")).toBe(
      "https://example.com/jobs?a=1&b=2&c=3",
    );
  });

  it("drops the question mark when every parameter was tracking", () => {
    expect(normalizeJobUrl("https://example.com/jobs/1?utm_source=li")).toBe(
      "https://example.com/jobs/1",
    );
  });

  it("gives the same output for the two ways of reaching one Posting", () => {
    const fromSearch =
      "https://WWW.Example.com/jobs/view/1?trackingId=abc%3D&refId=zz#footer";
    const fromShare = "https://www.example.com/jobs/view/1?utm_source=share";
    expect(normalizeJobUrl(fromSearch)).toBe(normalizeJobUrl(fromShare));
  });

  it("is idempotent", () => {
    const once = normalizeJobUrl(
      "https://Example.com/jobs?b=2&utm_source=x&a=1#x",
    );
    expect(normalizeJobUrl(once)).toBe(once);
  });

  it("throws on input that is not a URL", () => {
    expect(() => normalizeJobUrl("example.com/jobs")).toThrow();
  });
});
