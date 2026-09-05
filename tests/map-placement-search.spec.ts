import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, waitForMarkersToLoad } from './helpers';

// Placement mode's address-first path (#1134, storyboard screen 1): a
// search pill jumps the map to a typed address — the crosshair pin stays
// centered, so the jump IS the placement. Explicit submit only. Hermetic:
// the Nominatim /search call is stubbed per test.
test.describe('Placement address search', () => {
	test.use({ serviceWorkers: 'block' });

	const startPlacement = async (page: Page) => {
		await stubMapData(page);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await page.getByRole('button', { name: /^menu$/i }).click();
		await page.getByRole('button', { name: 'Add location' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
	};

	test('a picked result jumps the map to the address', async ({ page }) => {
		await page.route(
			(u) => u.hostname === 'nominatim.openstreetmap.org',
			(route) =>
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([
						{ lat: '42.2851', lon: '42.7110', display_name: 'Stub Street 1, Kutaisi' }
					])
				})
		);
		await startPlacement(page);

		const input = page.getByPlaceholder('Type an address to jump there');
		await input.fill('Stub Street 1');
		await input.press('Enter');
		const result = page.getByRole('button', { name: /Stub Street 1, Kutaisi/ });
		await expect(result).toBeVisible();
		await result.click();

		// The map eased to the result — the hash follows on moveend — and
		// placement stays active with the confirm sheet up.
		await expect(page).toHaveURL(/42\.285\d*\/42\.71\d*/, {
			timeout: MARKER_LOAD_TIMEOUT
		});
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		// The dropdown cleared after the jump.
		await expect(result).toBeHidden();
	});

	test('an unknown address says so instead of jumping', async ({ page }) => {
		await page.route(
			(u) => u.hostname === 'nominatim.openstreetmap.org',
			(route) =>
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: '[]'
				})
		);
		await startPlacement(page);

		const input = page.getByPlaceholder('Type an address to jump there');
		await input.fill('xyzzy nowhere');
		await input.press('Enter');
		await expect(page.getByText('Nothing found for that address.')).toBeVisible();
		await expect(page).toHaveURL(/42\.276\d*\/42\.70\d*/);
	});

	test('the search pill leaves with the placement sheet', async ({ page }) => {
		await startPlacement(page);
		await expect(
			page.getByPlaceholder('Type an address to jump there')
		).toBeVisible();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(
			page.getByPlaceholder('Type an address to jump there')
		).toBeHidden();
	});
});
