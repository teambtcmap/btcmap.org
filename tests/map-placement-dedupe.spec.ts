import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { stubMapData, stubReverseGeocode, waitForMarkersToLoad } from './helpers';

// Step 3 of the add-location redesign (#1134): confirming a placement pin
// near existing places interrupts with a duplicate check before the form.
// Hermetic via stubMapData. The dedupe radius is viewport-derived (nearby
// list formula, clamped 250 m–1 km) — at these specs' zoom-17 desktop
// viewport it works out to ~1 km, so in-radius fixtures sit at the center
// and out-of-radius decoys ~2.2 km away. The static feed carries no `name`
// field in production, so the first test stubs name-less places and layers
// a /v4/places/search/ route on top (registered after stubMapData so it
// wins) to supply the candidate's name, mirroring how the interrupt
// actually resolves names at show time.
test.describe('Placement dedupe interrupt', () => {
	test.use({ serviceWorkers: 'block' });

	const startPlacement = async (page: Page) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await page.getByRole('button', { name: /^menu$/i }).click();
		await page.getByRole('button', { name: 'Add location' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
	};

	test('confirm near an existing place shows the interrupt; Back returns', async ({
		page
	}) => {
		// Name-less places, matching the real static feed (no `name` key).
		// Ids 2–3 sit ~2.2 km north — outside the 1 km radius cap.
		await stubMapData(page, [
			{ id: 1, lat: 42.2762, lon: 42.7024, icon: 'restaurant' },
			{ id: 2, lat: 42.2963, lon: 42.7024, icon: 'question_mark' },
			{ id: 3, lat: 42.2963, lon: 42.7124, icon: 'cafe' }
		]);
		// Registered after stubMapData so this route wins (Playwright matches
		// routes in reverse registration order) and supplies the candidate name
		// the interrupt fetches at show time.
		await page.route('**/v4/places/search/**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Stub Cafe' }])
			})
		);
		await startPlacement(page);

		await page.getByRole('button', { name: 'Add a place here' }).click();
		await expect(page.getByText('Is it one of these?')).toBeVisible();
		// Only the in-radius candidate is listed, routed into the verify/
		// update flow (deck slide 7). The name arrives via the radius search
		// stub, not the (name-less) feed.
		const candidate = page.getByRole('link', { name: /Stub Cafe/ });
		await expect(candidate).toHaveAttribute('href', '/verify-location?id=1');
		// Radius filter: only id 1 (~6 m) sits inside the clamped ~1 km
		// radius; ids 2–3 are ~2.2 km north — exactly one candidate renders.
		await expect(page.locator('a[href^="/verify-location"]')).toHaveCount(1);
		// No navigation happened yet.
		await expect(page).toHaveURL(/\/map/);

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
		await expect(page.getByText('Is it one of these?')).toBeHidden();
	});

	test('add-anyway continues to the in-map form with the pin coords', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		await startPlacement(page);

		await page.getByRole('button', { name: 'Add a place here' }).click();
		await page.getByRole('button', { name: 'Add a new place' }).click();
		// The form opens on the map itself (#1134): the URL stays /map, with
		// ?add=form marking the state and the pin still in the hash.
		await expect(page).toHaveURL(/\/map\?add=form#\d+(\.\d+)?\/42\.27\d+\/42\.70\d+/);
		await expect(page.locator('#name')).toBeVisible();
	});

	test('no nearby places goes straight to the in-map form', async ({ page }) => {
		// One stub place far outside the radius — markers load, no candidates.
		await stubMapData(page, [
			{ id: 9, lat: 42.3, lon: 42.75, icon: 'cafe', name: 'Far Place' }
		]);
		await stubReverseGeocode(page);
		await startPlacement(page);

		await page.getByRole('button', { name: 'Add a place here' }).click();
		await expect(page).toHaveURL(/\/map\?add=form#\d+(\.\d+)?\/42\.27\d+\/42\.70\d+/);
		await expect(page.locator('#name')).toBeVisible();
	});

	test('falls back to Unnamed place when the name lookup returns nothing', async ({
		page
	}) => {
		// A single name-less place, matching the real static feed (no `name`
		// key). No extra search route — stubMapData's catch-all already
		// answers [], so the lookup settles empty and the fallback shows.
		await stubMapData(page, [
			{ id: 1, lat: 42.2762, lon: 42.7024, icon: 'restaurant' }
		]);
		await startPlacement(page);

		await page.getByRole('button', { name: 'Add a place here' }).click();
		await expect(page.getByText('Is it one of these?')).toBeVisible();
		const candidate = page.getByRole('link', { name: /Unnamed place/ });
		await expect(candidate).toBeVisible();
		await expect(candidate).toHaveAttribute('href', '/verify-location?id=1');
	});

	test('low zoom gates confirm behind a zoom-in step', async ({ page }) => {
		await stubMapData(page);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#13/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await page.getByRole('button', { name: /^menu$/i }).click();
		await page.getByRole('button', { name: 'Add location' }).click();
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();

		// Below detail zoom the primary action is the zoom step, not confirm.
		const zoomButton = page.getByRole('button', {
			name: 'Zoom in to place the pin'
		});
		await expect(zoomButton).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Add a place here' })
		).toBeHidden();

		await zoomButton.click();
		// easeTo animates to zoom 15; the gate lifts when it lands.
		await expect(
			page.getByRole('button', { name: 'Add a place here' })
		).toBeVisible();
	});
});
