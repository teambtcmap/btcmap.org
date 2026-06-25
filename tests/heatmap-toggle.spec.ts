import { test, expect } from '@playwright/test';
import {
	waitForMarkersToLoad,
	setupConsoleErrorCollection,
	checkForConsoleErrors,
} from './helpers';

test.describe('Heatmap Toggle', () => {
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	const toggle = (page: import('@playwright/test').Page) =>
		page.getByRole('button', { name: /toggle merchant density heatmap/i });

	test('toggle button is visible on the map', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		await waitForMarkersToLoad(page);
		await expect(toggle(page)).toBeVisible();
	});

	test('starts in the off state', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		await waitForMarkersToLoad(page);
		const btn = toggle(page);
		await expect(btn).toBeVisible();

		await expect(btn).toHaveAttribute('aria-pressed', 'false');
		await expect(btn).not.toHaveClass(/maplibregl-ctrl-heatmap-enabled/);
	});

	test('clicking toggles aria-pressed and CSS class on', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		await waitForMarkersToLoad(page);
		const btn = toggle(page);
		await expect(btn).toBeVisible();

		await btn.click();

		await expect(btn).toHaveAttribute('aria-pressed', 'true');
		await expect(btn).toHaveClass(/maplibregl-ctrl-heatmap-enabled/);
	});

	test('clicking twice returns to off state', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		await waitForMarkersToLoad(page);
		const btn = toggle(page);
		await expect(btn).toBeVisible();

		await btn.click();
		await expect(btn).toHaveAttribute('aria-pressed', 'true');

		await btn.click();
		await expect(btn).toHaveAttribute('aria-pressed', 'false');
		await expect(btn).not.toHaveClass(/maplibregl-ctrl-heatmap-enabled/);
	});

	test('persists across page reload', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		await waitForMarkersToLoad(page);
		const btn = toggle(page);
		await expect(btn).toBeVisible();

		// Enable heatmap
		await btn.click();
		await expect(btn).toHaveAttribute('aria-pressed', 'true');

		// Reload
		await page.reload({ waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);
		await waitForMarkersToLoad(page);

		// Should still be enabled
		const btnAfter = toggle(page);
		await expect(btnAfter).toBeVisible();
		await expect(btnAfter).toHaveAttribute('aria-pressed', 'true');
		await expect(btnAfter).toHaveClass(/maplibregl-ctrl-heatmap-enabled/);
	});
});
