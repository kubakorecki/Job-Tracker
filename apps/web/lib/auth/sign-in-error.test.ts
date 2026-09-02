import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./sign-in-error";

describe("signInErrorMessage", () => {
  it("names the credentials as the problem when they are rejected", () => {
    expect(
      signInErrorMessage({ code: "invalid_credentials", status: 400 }),
    ).toBe("That email and password don't match an account.");
  });

  it("reports an unconfirmed email as its own distinct problem", () => {
    expect(
      signInErrorMessage({ code: "email_not_confirmed", status: 400 }),
    ).toBe("This account's email address hasn't been confirmed yet.");
  });

  it("tells the user to wait when the auth service rate-limits them", () => {
    expect(
      signInErrorMessage({ code: "over_request_rate_limit", status: 429 }),
    ).toBe("Too many sign-in attempts. Wait a minute and try again.");
  });

  it("falls back on the status when no code is given", () => {
    expect(signInErrorMessage({ code: undefined, status: 429 })).toBe(
      "Too many sign-in attempts. Wait a minute and try again.",
    );
  });

  it("blames the service, not the user, for an unrecognised failure", () => {
    expect(
      signInErrorMessage({ code: "unexpected_failure", status: 500 }),
    ).toBe("Couldn't sign in right now. Try again in a moment.");
  });
});
