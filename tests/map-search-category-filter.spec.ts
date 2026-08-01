import { test, expect } from '@playwright/test';
import { MARKER_LOAD_TIMEOUT, waitForMarkersToLoad } from './helpers';

// Regression guard for #1159: in search mode the category chips must narrow
// the map pins, not just the list — the marker pipeline previously rendered
// raw searchResults, so list and pins diverged.
const searchBody = (places: unknown[] = [], total = places.length) =>
	JSON.stringify({ places, total, hasMore: total > places.length });

// Near the test viewport (#17/42.2762511/42.7024218) so pins land in view.
const STUB_PLACES = [
	{ id: 9001, name: 'Resto One', lat: 42.2761, lon: 42.7023, icon: 'restaurant' },
	{ id: 9002, name: 'Resto Two', lat: 42.2764, lon: 42.7026, icon: 'restaurant' },
	{ id: 9003, name: 'Cafe Three', lat: 42.2766, lon: 42.7021, icon: 'local_cafe' }
];

test.describe('Map search category filter', () => {
	test('category chips narrow the search pins, All restores them', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		await page.route('**/api/search/places*', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: searchBody(STUB_PLACES)
			});
		});

		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
		await waitForMarkersToLoad(page);

		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await searchFacade.click();

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		const placesCount = () =>
			page.evaluate(
				() => (window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount ?? 0
			);

		await listPanel.locator('input[type="search"]').fill('resto');
		await page.waitForResponse((r) => r.url().includes('/api/search/places'), {
			timeout: 15000
		});
		// All three stubbed results become pins.
		await expect
			.poll(placesCount, { timeout: MARKER_LOAD_TIMEOUT })
			.toBe(STUB_PLACES.length);

		// Chip narrows the pins to the two restaurants (previously: list only).
		await listPanel.getByRole('radio', { name: /restaurant/i }).click();
		await expect.poll(placesCount, { timeout: 15000 }).toBe(2);

		// All restores the full result set.
		await listPanel.getByRole('radio', { name: /^all/i }).click();
		await expect.poll(placesCount, { timeout: 15000 }).toBe(STUB_PLACES.length);
	});
});
