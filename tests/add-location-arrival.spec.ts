import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, stubReverseGeocode } from './helpers';

// /add-location is retired to a redirect (#1134): the form lives on the
// map. The route survives only for old deep links — valid ?lat&long opens
// the in-map form at that pin, anything else lands in placement mode so
// the duplicate check can't be skipped. Every case ends on the map page,
// hence stubMapData + the service-worker block.
test.describe('Add Location — retired route redirects', () => {
	test.use({ serviceWorkers: 'block' });

	test('valid coords open the in-map form at the pin', async ({ page }) => {
		await stubMapData(page);
		// The form fires an address lookup on open (#1315) — stubbed so this
		// spec stays hermetic.
		await stubReverseGeocode(page);
		await page.goto('/add-location?lat=42.27625&long=42.70242');

		// Redirected to the map host with the pin in the hash (precision-
		// agnostic: the map rewrites hash formatting once it settles).
		await expect(page).toHaveURL(/\/map\?add=form#\d+(\.\d+)?\/42\.27\d+\/42\.70\d+/);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});
		// The pin carried through: the address prefill answered for it.
		await expect(page.locator('#address')).toHaveValue(/Freiheitsstraße/);
	});

	test('plain /add-location is sent to placement mode', async ({ page }) => {
		await stubMapData(page);
		await page.goto('/add-location');

		await expect(page).toHaveURL(/\/map\?add=/);
		// The placement sheet mounts once the map style is up — slow under
		// parallel workers, so give it the map-boot budget.
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});
	});

	test('malformed coords are sent to placement mode too', async ({ page }) => {
		await stubMapData(page);
		await page.goto('/add-location?lat=95&long=13.405');

		await expect(page).toHaveURL(/\/map\?add=/);
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});
	});
});
