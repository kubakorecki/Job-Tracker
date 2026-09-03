import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  dev: {
    server: {
      /**
       * The web app owns 3000 (`next dev --port 3000`). Left to itself WXT
       * takes "the first open port from 3000", and it finds 3000 open even
       * while Next is on it: Next binds the wildcard address and WXT binds
       * `localhost`, which the kernel allows. Both then answer on port 3000,
       * and a browser reaches whichever address it resolves first — so the
       * app's own `fetch` can land on the extension's dev server and 404.
       *
       * `strictPort` makes a future clash fail loudly rather than silently
       * sharing a port. `dev.server.origin` follows the port on its own.
       */
      port: 3001,
      strictPort: true,
    },
  },
  manifest: {
    name: 'Job Tracker',
    description: 'Save job postings to your Job Tracker in one click.',
    permissions: ['storage', 'activeTab', 'scripting', 'sidePanel'],
    action: {},
    /**
     * Pins the extension's identity. Without a `key`, Chrome derives the id of
     * an unpacked extension from the path it was loaded from, so moving the
     * checkout — or loading the same build on a second machine — mints a new
     * `chrome-extension://` origin and the API's CORS allowlist goes stale.
     * With one, the id is a function of this public key alone:
     *
     *   chrome-extension://okeljopaafaojopfkhjioaceeohjplhb
     *
     * That is the first sixteen bytes of the key's SHA-256, hex digits mapped
     * onto `a`-`p`, and it is what `EXTENSION_ORIGIN` names in the deployment
     * and in `apps/web/.env.local`. `docs/setup/deployment.md` carries the
     * one-liner that re-derives it from this key, for checking the two agree.
     *
     * Only the public half lives here, which is all Chrome needs to derive the
     * id. The private half signs a `.crx` and nothing in v1 packs one, so it
     * is not committed — it sits, ignored, at `.keys/extension.pem`. A store
     * build would be signed with the store's own key and would therefore be a
     * different extension with a different id, which is why the allowlist
     * takes a list rather than a single origin.
     */
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn/HqO1/wlFgZvjXfbgg22SvwRASYIH1exgWn0SQhm8ik5D3v1O0K7M7i2TLYoWpqa3IJlfOB/yC0pZVq22b2+8/tIele7x1Yi1rqiYxYzBxazl8NIfICFWkTnsf5AdJOJQMlpvBqKQi7G5n4jMjhHg4ofX7IDkGQGjEVccGl3B24F54KQfbWd4kM0G8bB5/LQKk7W/c72NFKEpuyjwRe+SkSEPRaxTjk+l1ihiu6PGDwI2Rz9ARgl/2N0pgpwNuFhvITKAFRPDxh3edRqkxUUcBMpK4V3m30/owgzrEfsY2Zjof2XzpKIaYMoDXes3ACw18ASOAVeWtMSFuOBF7KhwIDAQAB',
  },
});
