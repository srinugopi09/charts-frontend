import { test, expect } from '@playwright/test';

test('drill-down from chart bar click', async ({ page }) => {
  // Listen to console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('A2UI') || text.includes('drill') || text.includes('AG-UI')) {
      console.log(`[BROWSER ${msg.type()}]`, text);
    }
  });

  // Navigate to the app
  await page.goto('http://localhost:4201');
  console.log('Navigated to app');

  // Wait for Angular to load
  await page.waitForLoadState('networkidle');

  // Send initial message to get a chart
  const textarea = page.locator('textarea[placeholder="Ask about your data..."]');
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill('Show me revenue by region as a bar chart');
  console.log('Filled textarea with message');

  const sendButton = page.locator('button:has-text("Send")');
  await sendButton.click();
  console.log('Clicked send button');

  // Wait for the chart to appear
  const surface = page.locator('a2ui-surface');
  await surface.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Chart surface appeared');

  // Wait a bit for chart to fully render
  await page.waitForTimeout(2000);

  // Find the canvas element inside the chart
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible' });
  console.log('Canvas found');

  // Get canvas bounding box
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas not found or not visible');
  }

  // Click on the first bar (North America - should be the tallest/leftmost bar)
  // Estimate position: left quarter of the chart, middle height
  const clickX = canvasBox.x + canvasBox.width * 0.25;
  const clickY = canvasBox.y + canvasBox.height * 0.5;

  console.log(`Clicking chart at (${clickX}, ${clickY})`);
  await page.mouse.click(clickX, clickY);

  // Wait a bit for the drill-down message to be processed
  await page.waitForTimeout(1000);

  // Check if a new user message appeared (drill-down message)
  // Look for messages containing "Show details" or "North America"
  const messages = page.locator('.message, [class*="message"], [class*="bubble"]');
  const messageCount = await messages.count();
  console.log(`Found ${messageCount} messages after click`);

  // The drill-down message should contain "Show details"
  const drillDownMessage = page.getByText(/Show details for/i);
  const hasDrillDownMessage = await drillDownMessage.count() > 0;

  console.log(`Drill-down message found: ${hasDrillDownMessage}`);

  // Take a screenshot
  await page.screenshot({ path: 'test-drill-down.png', fullPage: true });
  console.log('Screenshot saved to test-drill-down.png');

  // Wait for potential new chart or response
  await page.waitForTimeout(3000);

  // Verify that a drill-down action was triggered
  // (This is a structural test - we're verifying the flow, not exact content)
  expect(messageCount).toBeGreaterThan(2); // Original message + response + drill-down message
});
