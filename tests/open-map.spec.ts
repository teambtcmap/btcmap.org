import { test, expect } from '@playwright/test';

test.describe('Open Map', () => {
	test('clicks open map button', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/');

		await page.waitForLoadState('domcontentloaded');

		// Wait for the page to load and find the "open map" button
		const openMapButton = page.getByRole('link', { name: /open map/i });
		await openMapButton.waitFor({ state: 'visible' });

		// Click the open map button
		await openMapButton.click();

		// Verify we're on the map page
		await expect(page).toHaveURL(/.*\/map/);
	});
});
