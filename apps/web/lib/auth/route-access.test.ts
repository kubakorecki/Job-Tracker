import { describe, expect, it } from "vitest";
import { routeAccessFor } from "./route-access";

describe("routeAccessFor", () => {
  it("sends a signed-out visitor from the dashboard to sign-in", () => {
    expect(routeAccessFor({ pathname: "/dashboard", signedIn: false })).toEqual(
      {
        kind: "redirect",
        to: "/sign-in",
      },
    );
  });

  it("sends a signed-out visitor from the site root to sign-in", () => {
    expect(routeAccessFor({ pathname: "/", signedIn: false })).toEqual({
      kind: "redirect",
      to: "/sign-in",
    });
  });

  it("lets a signed-out visitor reach sign-in", () => {
    expect(routeAccessFor({ pathname: "/sign-in", signedIn: false })).toEqual({
      kind: "allow",
    });
  });

  it("lets a signed-in user reach the dashboard", () => {
    expect(routeAccessFor({ pathname: "/dashboard", signedIn: true })).toEqual({
      kind: "allow",
    });
  });

  it("sends a signed-in user away from sign-in to the dashboard", () => {
    expect(routeAccessFor({ pathname: "/sign-in", signedIn: true })).toEqual({
      kind: "redirect",
      to: "/dashboard",
    });
  });

  it("treats a trailing slash as the same route", () => {
    expect(routeAccessFor({ pathname: "/sign-in/", signedIn: true })).toEqual({
      kind: "redirect",
      to: "/dashboard",
    });
  });

  it("guards routes that do not exist yet, so a new page is private by default", () => {
    expect(
      routeAccessFor({ pathname: "/settings/tokens", signedIn: false }),
    ).toEqual({ kind: "redirect", to: "/sign-in" });
  });
});
