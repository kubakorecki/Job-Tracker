import { describe, expect, it } from "vitest";
import { GENERAL_SCOPE } from "./contract";
import { standingAt } from "./scope";

/**
 * Which Conversation the panel is showing, decided by the address and nothing
 * else. There is no switcher and no picker anywhere in the UI, so this
 * function is the whole of the routing and the only thing that can get it
 * wrong.
 */

const ID = "3f4a1c2e-8b7d-4e5f-9a0b-1c2d3e4f5a6b";

describe("standing on a Job Application", () => {
  it("is that Job Application's Conversation", () => {
    expect(standingAt(`/dashboard/job-applications/${ID}`).scope).toBe(ID);
  });

  it("says which Conversation it is without offering another", () => {
    const { about, sees, invites } = standingAt(
      `/dashboard/job-applications/${ID}`,
    );

    expect(about).toBe("This Job Application");
    expect(sees).toContain("in full");
    // The panel branches on the kind nowhere: what to ask it comes from here
    // too, so a Conversation about one job never invites a question about all
    // of them.
    expect(invites).toContain("covering letter");
  });

  it("is still that Job Application's below its own page", () => {
    // Nothing sits under one today. A panel that fell back to the general
    // Conversation the moment a sub-page was added would move the user's chat
    // out from under them, and standing there is still standing on that job.
    expect(standingAt(`/dashboard/job-applications/${ID}/anything`).scope) //
      .toBe(ID);
  });

  it("ignores a trailing slash", () => {
    expect(standingAt(`/dashboard/job-applications/${ID}/`).scope).toBe(ID);
  });
});

describe("standing anywhere else", () => {
  it.each([
    "/dashboard",
    "/dashboard/",
    "/settings/profile",
    "/settings/tokens",
    "/",
  ])("is the general Conversation on %s", (pathname) => {
    expect(standingAt(pathname).scope).toBe(GENERAL_SCOPE);
  });

  it("says what the general one can and cannot see", () => {
    const { about, sees, invites } = standingAt("/dashboard");

    expect(about).toBe("Your job search");
    expect(invites).toContain("chase");
    // The limit is said plainly, so that a Conversation which cannot quote a
    // Posting reads as bounded rather than as the model being vague.
    expect(sees).toContain("outline");
  });

  it("is the general Conversation where the id could not be one", () => {
    // That address is a 404 on the page too, and a panel that addressed the
    // scope anyway would ask the API about a Job Application that cannot exist.
    expect(standingAt("/dashboard/job-applications/nonsense").scope) //
      .toBe(GENERAL_SCOPE);
  });
});
