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

	test('the pin stays frozen beside the form; Move pin re-places it and keeps the fields', async ({
		page
	}) => {
		// #1396. Every reverse lookup is one trigger of the address
		// suggestion: panning must not fire one, a confirmed Move pin must.
		let lookups = 0;
		page.on('request', (request) => {
			if (request.url().includes('nominatim.openstreetmap.org')) lookups++;
		});
		await openForm(page);
		const pinLine = page.getByText(/Pinned at/);
		await expect(pinLine).toContainText('42.27625, 42.70242');
		await expect(page.locator('#address')).toHaveValue(/Freiheitsstraße/);
		await page.locator('#name').fill('Satoshi Comics');

		// Pan beside the panel (it spans x 12–412 at 1280 wide). The hash
		// follows the viewport on moveend, which proves the pan registered.
		await page.mouse.move(900, 360);
		await page.mouse.down();
		await page.mouse.move(500, 360, { steps: 10 });
		await page.mouse.up();
		await expect(page).not.toHaveURL(/\/42\.702\d*$/);
		await page.waitForTimeout(600);
		// Frozen: same pin, no second lookup (one-shot reads after settling).
		await expect(pinLine).toContainText('42.27625, 42.70242');
		expect(lookups).toBe(1);

		await page.getByRole('button', { name: 'Move pin' }).click();
		await expect(page.getByText('Move the pin', { exact: true })).toBeVisible();
		await expect(page.locator('#name')).toBeHidden();
		// Re-placing starts from the frozen pin, not the panned viewport.
		await expect(page).toHaveURL(/\/42\.27\d*\/42\.702\d*$/);

		// The panel is hidden, so the whole map drags: shift the pin east.
		await page.mouse.move(800, 360);
		await page.mouse.down();
		await page.mouse.move(600, 360, { steps: 10 });
		await page.mouse.up();
		await expect(page).not.toHaveURL(/\/42\.702\d*$/);
		await page.waitForTimeout(600);
		await page.getByRole('button', { name: 'Use this position' }).click();

		// Back on the same form instance: typed text survived, the pin line
		// states the new pin, and the address suggestion re-ran once.
		await expect(page.locator('#name')).toBeVisible();
		await expect(page.locator('#name')).toHaveValue('Satoshi Comics');
		await expect(pinLine).not.toContainText('42.70242');
		await expect(page).toHaveURL(/\/map\?add=form/);
		await expect.poll(() => lookups).toBe(2);
	});

	test('confirming Move pin at once hands back the frozen pin, not a mid-flight centre', async ({
		page
	}) => {
		await openForm(page);
		const pinLine = page.getByText(/Pinned at/);
		await expect(pinLine).toContainText('42.27625, 42.70242');
		// Pan away so re-centring on the pin has distance to cover.
		await page.mouse.move(640, 500);
		await page.mouse.down();
		await page.mouse.move(900, 440, { steps: 10 });
		await page.mouse.up();
		await expect(page).not.toHaveURL(/\/42\.702\d*$/);
		await page.waitForTimeout(600);

		// Keyboard, back to back: Enter on Move pin hands focus to the
		// sheet's action, and an immediate second Enter confirms. It must
		// commit the pin the sheet opened on, never a centre the camera was
		// still passing through (a pointer click is too slow to catch that).
		await page.getByRole('button', { name: 'Move pin' }).focus();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Enter');
		await expect(page.locator('#name')).toBeVisible();
		await expect(pinLine).toContainText('42.27625, 42.70242');
	});

	test('below detail zoom, Move pin focuses the visible Zoom in action', async ({
		page
	}) => {
		// Arrive with the form open at z14, under the placement zoom gate.
		await stubMapData(page, [
			{ id: 9, lat: 42.3, lon: 42.75, icon: 'cafe', name: 'Far Place' }
		]);
		await stubReverseGeocode(page);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map?add=form#14/42.2762511/42.7024218', {
			waitUntil: 'load'
		});
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await expect(page.locator('#name')).toBeVisible();

		await page.getByRole('button', { name: 'Move pin' }).click();
		const zoomIn = page.getByRole('button', { name: 'Zoom in to place the pin' });
		await expect(zoomIn).toBeFocused();
		// Zooming in swaps the action in place — focus follows it.
		await page.keyboard.press('Enter');
		await expect(
			page.getByRole('button', { name: 'Use this position' })
		).toBeFocused();
	});

	test('Escape backs out of Move pin without closing the form', async ({
		page
	}) => {
		await openForm(page);
		await page.locator('#name').fill('Satoshi Comics');
		await page.getByRole('button', { name: 'Move pin' }).click();
		await expect(page.getByText('Move the pin', { exact: true })).toBeVisible();

		await page.keyboard.press('Escape');
		// Back on the form, not the placement sheet, with nothing lost.
		await expect(page.locator('#name')).toBeVisible();
		await expect(page.locator('#name')).toHaveValue('Satoshi Comics');
		await expect(page.getByText('Move the pin', { exact: true })).toBeHidden();
		await expect(page.getByText('Place the pin', { exact: true })).toBeHidden();
		await expect(page).toHaveURL(/\/map\?add=form/);
		// Focus returns to the control that started it.
		await expect(page.getByRole('button', { name: 'Move pin' })).toBeFocused();
	});
});
