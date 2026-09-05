import { errorResponse } from "./response";

/**
 * The one place cross-origin access is decided. The side panel runs on an
 * extension origin, so every call the extension makes is cross-origin — and a
 * per-route header would mean a route added later silently refusing it.
 * `authenticatedRoute` puts these headers on every response, and each
 * `route.ts` re-exports `OPTIONS` from here for the preflight.
 *
 * Credentials are deliberately never allowed. The extension authenticates with
 * a Bearer Personal Access Token, so no browser needs to send this API a
 * cookie from another origin, and saying so is what lets the allowlist be an
 * allowlist rather than a wildcard.
 */

/**
 * Where the dashboard and its API are served from in development, and the
 * origin an extension development build is pointed at. A deployment allows it
 * no more than any other stranger: there, the dashboard is same-origin and has
 * no use for CORS at all.
 */
export const LOCAL_DEVELOPMENT_ORIGIN = "http://localhost:3000";

const ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";

/** `authorization` is how the extension signs in; `content-type` is its bodies. */
const ALLOWED_HEADERS = "authorization, content-type";

/** A day, so a browser stops asking for every request the panel makes. */
const MAX_AGE = "86400";

/**
 * Who may call this API. The extension's origin is `chrome-extension://<id>`
 * and its id is pinned in the manifest (ticket 08), so it belongs in the
 * environment rather than in this file — dev and production builds are
 * different extensions. Several may be listed, separated by commas.
 */
export function allowedOrigins(): string[] {
  const pinned = process.env.EXTENSION_ORIGIN ?? "";

  return [
    ...(process.env.NODE_ENV === "production"
      ? []
      : [LOCAL_DEVELOPMENT_ORIGIN]),
    ...pinned
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ""),
  ];
}

/**
 * The response, told which origin may read it. An origin that is not on the
 * allowlist gets the response with no permission attached, which is what makes
 * the browser withhold it.
 */
export function withCors(
  request: Request,
  response: Response,
  origins: string[] = allowedOrigins(),
): Response {
  return merge(response, corsHeaders(request, origins, { preflight: false }));
}

/**
 * The `OPTIONS` handler every route exports. A preflight arrives before the
 * real request and carries no credential of any kind, so it is answered on the
 * origin alone: allowed origins are told what they may then send, and one that
 * is not on the list is refused outright rather than left to fail silently.
 *
 * The allowlist is substitutable so it can be tested; nothing but a test ever
 * passes it, and a route's own export reads the environment per request.
 */
export function corsPreflight(allowlist?: string[]) {
  return (request: Request): Response => {
    const origins = allowlist ?? allowedOrigins();
    const origin = request.headers.get("origin");
    const headers = corsHeaders(request, origins, { preflight: true });

    // No origin at all is not a cross-origin request, and has nothing to allow.
    if (origin === null || origins.includes(origin)) {
      return merge(new Response(null, { status: 204 }), headers);
    }

    return merge(
      errorResponse("This origin may not use the Job Tracker API.", 403),
      headers,
    );
  };
}

/** Every route's `OPTIONS`, so the preflight is answered the same way once. */
export const OPTIONS = corsPreflight();

function corsHeaders(
  request: Request,
  origins: string[],
  { preflight }: { preflight: boolean },
): Headers {
  const headers = new Headers();
  // The answer depends on who asked, so a cache must not serve one origin's
  // response to another.
  headers.append("Vary", "Origin");

  const origin = request.headers.get("origin");
  if (origin === null || !origins.includes(origin)) return headers;

  headers.set("Access-Control-Allow-Origin", origin);
  if (preflight) {
    headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    headers.set("Access-Control-Max-Age", MAX_AGE);
  }

  return headers;
}

/** The response as it was, plus these headers. */
function merge(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  for (const [name, value] of headers) merged.append(name, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
