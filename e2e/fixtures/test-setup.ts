import { test as base } from '@playwright/test';

/**
 * Test setup fixture for E2E tests
 *
 * Extends base Playwright test with custom fixtures
 * for chat helpers, canvas helpers, and common assertions
 */

export const test = base.extend({
  // Add custom fixtures here as we build out the test suite
});

export { expect } from '@playwright/test';
