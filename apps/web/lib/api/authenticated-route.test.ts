import { describe, expect, it } from "vitest";
import { authenticatedRoute, sessionRoute } from "./authenticated-route";
import { LOCAL_DEVELOPMENT_ORIGIN } from "./cors";
import { TEST_USER } from "../test-support/users";

const request = (headers: HeadersInit = {}) =>
  new Request("https://job-tracker.test/api/anything", { headers });

/** What Next.js hands a handler on a route with no dynamic segment. */
const noParams = { params: Promise.resolve({}) };

describe("authenticatedRoute", () => {
  it("refuses a request the resolver cannot identify", async () => {
    const route = authenticatedRoute(
      async () => Response.json({ reached: true }),
      async () => null,
    );

    const response = await route(request(), noParams);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in, or send a Personal Access Token, to use this endpoint.",
    });
  });

  it("hands the resolved user to the handler", async () => {
    const route = authenticatedRoute(
      async (_request, user) => Response.json({ userId: user.id }),
      async () => TEST_USER,
    );

    const response = await route(request(), noParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userId: TEST_USER.id });
  });

  it("hands the request to the resolver, which is how a Bearer token gets read", async () => {
    let seen: string | null = null;
    const route = authenticatedRoute(
      async () => Response.json({ reached: true }),
      async (request) => {
        seen = request.headers.get("authorization");
        return TEST_USER;
      },
    );

    await route(request({ authorization: "Bearer jbt_something" }), noParams);

    expect(seen).toBe("Bearer jbt_something");
  });

  it("carries CORS headers on every answer it gives, refusal included", async () => {
    const route = authenticatedRoute(
      async () => Response.json({ reached: true }),
      async () => null,
    );

    const response = await route(
      request({ origin: LOCAL_DEVELOPMENT_ORIGIN }),
      noParams,
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      LOCAL_DEVELOPMENT_ORIGIN,
    );
  });
});

describe("sessionRoute", () => {
  it("refuses a caller carrying a Personal Access Token, so one cannot mint another", async () => {
    const route = sessionRoute(
      async () => Response.json({ reached: true }),
      // Asked without a request, the resolver has no `Authorization` header to
      // read — which is what a token presented here comes up against.
      async () => null,
    );

    const response = await route(
      request({ authorization: "Bearer jbt_stolen" }),
      noParams,
    );

    expect(response.status).toBe(401);
  });

  it("lets a session through", async () => {
    const route = sessionRoute(
      async (_request, user) => Response.json({ userId: user.id }),
      async () => TEST_USER,
    );

    const response = await route(request(), noParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userId: TEST_USER.id });
  });
});
