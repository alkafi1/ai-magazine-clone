import { defineConfig, devices } from '@playwright/test';

// Isolated stack: test DB (aimag_e2e), API :4010, production web build :3110. See e2e/run-*.sh.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1, // admin tests mutate the shared database
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3110',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bash e2e/run-api.sh',
      url: 'http://localhost:4010/health',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'bash e2e/run-web.sh',
      url: 'http://localhost:3110/about',
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
