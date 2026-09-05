import { afterEach, describe, expect, it } from "vitest";
import {
  allowedOrigins,
  corsPreflight,
  LOCAL_DEVELOPMENT_ORIGIN,
  withCors,
} from "./cors";

/**
 * The allowlist as ticket 08 pinned it: the extension's own origin, plus the
 * origin the dashboard is served from in development. Passed explicitly so
 * these assertions do not depend on what is in the environment.
 *
 * The id is the one the `key` in `apps/extension/wxt.config.ts` derives — the
 * same in every build of this repository — so a reader comparing the two finds
 * the same string rather than a stand-in.
 */
const EXTENSION_ORIGIN = "chrome-extension://okeljopaafaojopfkhjioaceeohjplhb";
const ORIGINS = [LOCAL_DEVELOPMENT_ORIGIN, EXTENSION_ORIGIN];

const ENDPOINT = "https://job-tracker.test/api/job-applications";

const preflight = (origin?: string) =>
  corsPreflight(ORIGINS)(
    new Request(ENDPOINT, {
      method: "OPTIONS",
      headers: {
        ...(origin === undefined ? {} : { origin }),
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
      },
    }),
  );

const answer = (origin?: string) =>
  withCors(
    new Request(ENDPOINT, {
      headers: origin === undefined ? {} : { origin },
    }),
    Response.json({ ok: true }),
    ORIGINS,
  );

describe("a preflight", () => {
  it("lets the extension's origin through", () => {
    const response = preflight(EXTENSION_ORIGIN);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      EXTENSION_ORIGIN,
    );
  });

  it("lets the local development origin through", () => {
    const response = preflight(LOCAL_DEVELOPMENT_ORIGIN);

    expect(response.headers.get("access-control-allow-origin")).toBe(
      LOCAL_DEVELOPMENT_ORIGIN,
    );
  });

  it("permits the authorization header, which is how the extension signs in", () => {
    const allowed = preflight(EXTENSION_ORIGIN).headers.get(
      "access-control-allow-headers",
    );

    expect(allowed?.toLowerCase()).toContain("authorization");
  });

  it("permits every method the API answers", () => {
    const allowed =
      preflight(EXTENSION_ORIGIN).headers.get("access-control-allow-methods") ??
      "";

    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      expect(allowed).toContain(method);
    }
  });

  it("refuses an origin that is not on the allowlist", () => {
    const response = preflight("https://not-the-extension.test");

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows nothing when there is no origin to allow", () => {
    const response = preflight();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("a response", () => {
  it("carries the allowed origin back", () => {
    expect(
      answer(EXTENSION_ORIGIN).headers.get("access-control-allow-origin"),
    ).toBe(EXTENSION_ORIGIN);
  });

  it("carries no origin back to one that is not allowed", () => {
    expect(
      answer("https://not-the-extension.test").headers.get(
        "access-control-allow-origin",
      ),
    ).toBeNull();
  });

  it("keeps the status and the body it was given", async () => {
    const response = withCors(
      new Request(ENDPOINT, { headers: { origin: EXTENSION_ORIGIN } }),
      Response.json({ error: "No such Job Application." }, { status: 404 }),
      ORIGINS,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No such Job Application.",
    });
  });

  it("says its content depends on the origin, so a cache cannot mix the two up", () => {
    expect(answer(EXTENSION_ORIGIN).headers.get("vary")).toContain("Origin");
    expect(
      answer("https://not-the-extension.test").headers.get("vary"),
    ).toContain("Origin");
  });
});

describe("credentials", () => {
  it("are never allowed: the extension authenticates with a token, not a cookie", () => {
    expect(
      preflight(EXTENSION_ORIGIN).headers.get(
        "access-control-allow-credentials",
      ),
    ).toBeNull();
    expect(
      answer(EXTENSION_ORIGIN).headers.get("access-control-allow-credentials"),
    ).toBeNull();
  });
});

describe("the allowlist", () => {
  const pinned = process.env.EXTENSION_ORIGIN;

  afterEach(() => {
    process.env.EXTENSION_ORIGIN = pinned;
  });

  it("takes the extension's origin from the environment, where ticket 08 pins it", () => {
    process.env.EXTENSION_ORIGIN = EXTENSION_ORIGIN;

    expect(allowedOrigins()).toContain(EXTENSION_ORIGIN);
  });

  it("takes several, so a development build and a store build can both be allowed", () => {
    const store = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.EXTENSION_ORIGIN = `${EXTENSION_ORIGIN}, ${store}`;

    expect(allowedOrigins()).toEqual(
      expect.arrayContaining([EXTENSION_ORIGIN, store]),
    );
  });

  it("allows the local development origin outside a deployment", () => {
    delete process.env.EXTENSION_ORIGIN;

    expect(allowedOrigins()).toEqual([LOCAL_DEVELOPMENT_ORIGIN]);
  });
});
