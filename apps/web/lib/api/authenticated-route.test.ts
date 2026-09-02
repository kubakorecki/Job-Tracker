import { describe, expect, it } from "vitest";
import { authenticatedRoute } from "./authenticated-route";
import { TEST_USER } from "../test-support/users";

const request = () => new Request("https://job-tracker.test/api/anything");

describe("authenticatedRoute", () => {
  it("refuses a request the resolver cannot identify", async () => {
    const route = authenticatedRoute(
      async () => Response.json({ reached: true }),
      async () => null,
    );

    const response = await route(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in to use this endpoint.",
    });
  });

  it("hands the resolved user to the handler", async () => {
    const route = authenticatedRoute(
      async (_request, user) => Response.json({ userId: user.id }),
      async () => TEST_USER,
    );

    const response = await route(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userId: TEST_USER.id });
  });
});
