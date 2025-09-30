import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'client/out/test/integration/**/*.test.js',
  version: 'insiders',
  launchArgs: [
    '--disable-extensions',
    '--disable-workspace-trust'
  ],
  mocha: {
    ui: 'bdd',
    timeout: 20000
  }
});