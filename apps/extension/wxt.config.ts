import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Job Tracker',
    description: 'Save job postings to your Job Tracker in one click.',
    permissions: ['storage', 'activeTab', 'scripting', 'sidePanel'],
    action: {},
  },
});
