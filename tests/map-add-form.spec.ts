import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { stubMapData, stubReverseGeocode, waitForMarkersToLoad } from './helpers';

// The in-map form host (#1134): confirming a placement pin opens the
// add-location form over the map (right panel on desktop, full-screen
// sheet on mobile) instead of navigating to /add-location. Hermetic via
// stubMapData; the single stub place sits far outside the dedupe radius
// so confirm skips the interrupt. The SW block lets page.route see the
// stubbed reverse-geocode call the form fires on open.
test.describe('In-map add form', () => {
	test.use({ serviceWorkers: 'block' });

	const openForm = async (page: Page) => {
		await stubMapData(page, [
			{ id: 9, lat: 42.3, lon: 42.75, icon: 'cafe', name: 'Far Place' }
		]);
		await stubReverseGeocode(page);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await page.getByRole('button', { name: /^menu$/i }).click();
		await page.getByRole('button', { name: 'Add location' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Add a place here' }).click();
		await expect(page.locator('#name')).toBeVisible();
	};

	test('confirm opens the form over the map and close returns to placement', async ({
		page
	}) => {
		await openForm(page);

		// Same page, form state in the URL, pin still in the hash.
		await expect(page).toHaveURL(/\/map\?add=form/);
		// The address prefill worked against the live pin (stub fixture).
		await expect(page.locator('#address')).toHaveValue(/Freiheitsstraße/);
		// Placement sheets are gone while the form is open.
		await expect(page.getByText('Place the pin', { exact: true })).toBeHidden();

		// × returns to the placement sheet (the sheet's Cancel is unmounted,
		// so the accessible name is unambiguous).
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		await expect(page.locator('#name')).toBeHidden();
		await expect(page).toHaveURL(/\/map\?add(?!=form)/);
	});

	test('browser back walks the form back onto the placement sheet', async ({
		page
	}) => {
		await openForm(page);

		await page.goBack();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		await expect(page.locator('#name')).toBeHidden();
		// Still on the map — back closed the form, not the page.
		await expect(page).toHaveURL(/\/map\?add/);
	});

	test('reloading ?add=form reopens the form at the hash pin', async ({
		page
	}) => {
		await openForm(page);

		await page.reload({ waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await expect(page.locator('#name')).toBeVisible();
		await expect(page).toHaveURL(/\/map\?add=form/);
	});

	test('closing a deep-linked form falls back to placement without history', async ({
		page
	}) => {
		// A direct ?add=form arrival has no placement entry beneath it, so
		// Escape/× must close in place instead of relying on history.back().
		await stubMapData(page, [
			{ id: 9, lat: 42.3, lon: 42.75, icon: 'cafe', name: 'Far Place' }
		]);
		await stubReverseGeocode(page);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map?add=form#17/42.2762511/42.7024218', {
			waitUntil: 'load'
		});
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await expect(page.locator('#name')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		await expect(page.locator('#name')).toBeHidden();
		// Still on the map, normalized to the bare placement URL, with the
		// pin's hash intact (precision-agnostic: the map rewrites the hash
		// with its own formatting on moveend).
		await expect(page).toHaveURL(
			/\/map\?add(?!=form).*#\d+(\.\d+)?\/42\.27\d+\/42\.70\d+/
		);
	});

	test('mobile: the form is a full-screen sheet and closes back to placement', async ({
		page
	}) => {
		await stubMapData(page, [
			{ id: 9, lat: 42.3, lon: 42.75, icon: 'cafe', name: 'Far Place' }
		]);
		await stubReverseGeocode(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await page.getByRole('button', { name: /^menu$/i }).click();
		await page.getByRole('button', { name: 'Add location' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Add a place here' }).click();

		const sheet = page.getByRole('region', { name: 'Add Location' });
		await expect(sheet).toBeVisible();
		// Full-screen on mobile: the sheet spans the whole viewport.
		const box = await sheet.boundingBox();
		expect(box?.width).toBeCloseTo(375, 0);
		expect(box?.height).toBeCloseTo(812, 0);

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		await expect(page.locator('#name')).toBeHidden();
	});
});
