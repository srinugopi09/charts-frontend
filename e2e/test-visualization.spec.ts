import { test, expect } from '@playwright/test';

test('send message and verify visualization', async ({ page }) => {
  // Listen to console logs to see backend communication
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('A2UI') || text.includes('AG-UI') || text.includes('visualization')) {
      console.log(`[BROWSER ${msg.type()}]`, text);
    }
  });

  // Navigate to the app
  await page.goto('http://localhost:4201');
  console.log('Navigated to app');

  // Wait for Angular to load
  await page.waitForLoadState('networkidle');

  // Find and fill the textarea
  const textarea = page.locator('textarea[placeholder="Ask about your data..."]');
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill('Show me revenue by region as a bar chart');
  console.log('Filled textarea with message');

  // Click send button
  const sendButton = page.locator('button:has-text("Send")');
  await sendButton.click();
  console.log('Clicked send button');

  // Wait for assistant response (white bubble with markdown)
  await page.locator('.bg-white.rounded-lg.px-4.py-3.shadow-sm').waitFor({
    state: 'visible',
    timeout: 30000
  });
  console.log('Assistant message appeared');

  // Wait a bit for the visualization to process
  await page.waitForTimeout(5000);

  // Check if a2ui-surface appeared
  const surface = page.locator('a2ui-surface');
  const surfaceCount = await surface.count();
  console.log(`Found ${surfaceCount} a2ui-surface elements`);

  if (surfaceCount > 0) {
    console.log('✅ Visualization rendered successfully!');
  } else {
    console.log('❌ No visualization found on canvas');
  }

  // Take a screenshot
  await page.screenshot({ path: 'test-result.png', fullPage: true });
  console.log('Screenshot saved to test-result.png');

  // Assertion
  expect(surfaceCount).toBeGreaterThan(0);
});
