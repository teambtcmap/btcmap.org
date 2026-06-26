import { test, expect } from '@playwright/test';
import {
	waitForMarkersToLoad,
	setupConsoleErrorCollection,
	checkForConsoleErrors,
} from './helpers';

// The heatmap toggle now lives as a switch inside the "Layers & filters"
// modal (was a standalone map control). Each test opens the panel first.
test.describe('Heatmap toggle', () => {
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	const openPanel = (page: import('@playwright/test').Page) =>
		page.getByRole('button', { name: /layers & filters/i }).click();
	const heatmapSwitch = (page: import('@playwright/test').Page) =>
		page.getByRole('switch', { name: /toggle merchant density heatmap/i });

	test('switch is reachable from the tools panel and starts off', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);
		await waitForMarkersToLoad(page);

		await openPanel(page);
		const sw = heatmapSwitch(page);
		await expect(sw).toBeVisible();
		await expect(sw).toHaveAttribute('aria-checked', 'false');
	});

	test('clicking toggles aria-checked on then off', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		await openPanel(page);
		await heatmapSwitch(page).click();
		await expect(heatmapSwitch(page)).toHaveAttribute('aria-checked', 'true');

		await heatmapSwitch(page).click();
		await expect(heatmapSwitch(page)).toHaveAttribute('aria-checked', 'false');
	});

	test('persists across page reload', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		await openPanel(page);
		await heatmapSwitch(page).click();
		await expect(heatmapSwitch(page)).toHaveAttribute('aria-checked', 'true');

		await page.reload({ waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);
		await waitForMarkersToLoad(page);

		await openPanel(page);
		await expect(heatmapSwitch(page)).toHaveAttribute('aria-checked', 'true');
	});
});
