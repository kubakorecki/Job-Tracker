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
  },
});
