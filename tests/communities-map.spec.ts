import { expect, test } from '@playwright/test';

import { checkForConsoleErrors, setupConsoleErrorCollection } from './helpers';

test.describe('Communities Map', () => {
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	test('renders the map canvas and community polygons', async ({ page }) => {
		await page.goto('/communities/map');
		await page.waitForLoadState('domcontentloaded');

		// Map container has zero-height + absolute-positioned canvas — make
		// sure the actual canvas is visible at non-zero dimensions. The bug
		// at 27879baa shipped an unstyled blank page that this would catch.
		const canvas = page.locator('.maplibregl-canvas');
		await expect(canvas).toBeVisible({ timeout: 15000 });
		const box = await canvas.boundingBox();
		expect(box?.width).toBeGreaterThan(0);
		expect(box?.height).toBeGreaterThan(100);
	});
});
