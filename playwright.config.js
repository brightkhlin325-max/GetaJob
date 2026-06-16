// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const os = require('os');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  // Set fullyParallel to false to prevent SQLite database locks during concurrent tests
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // SQLite is single-write, so we must limit worker count to 1 for database state predictability
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: 'test',
        GETAJOB_ENV: 'test',
        // Directs SQLite wrapper to initialize a separate database for E2E tests
        GETAJOB_DB_PATH: path.join(
          process.env.USERPROFILE || process.env.HOME || os.homedir(),
          '.getajob',
          'getajob_test.db'
        ),
        GEMINI_BASE_URL: 'http://localhost:8089',
      },
    },
    {
      command: 'node tests/helpers/gemini-mock.js',
      url: 'http://localhost:8089',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    }
  ],
});
