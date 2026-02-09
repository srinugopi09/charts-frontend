import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Agentic Analytics Chatbot E2E tests
 *
 * Tests against local dev server on port 4201
 * Backend must be running on port 8080 (managed separately by user)
 * Web only (Chromium) with multiple viewport sizes for responsive testing
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2, // LLM responses can be non-deterministic
  workers: 1, // Serial execution - shared backend state
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:4201',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  timeout: 60000, // 60s - LLM responses can take 10-30s
  expect: {
    timeout: 30000, // 30s - chart rendering may take time
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'chromium-tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
      },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4201',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
