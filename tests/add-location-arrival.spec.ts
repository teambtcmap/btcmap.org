import { expect, test } from '@playwright/test';

import { stubMapData } from './helpers';

// Arrival state for pins handed over from the map's placement mode (#1134).
// The form only ever opens with valid ?lat&long: the route's load guard
// sends everything else — nav links, bookmarks, malformed deep links — to
// placement mode, so the duplicate check can't be skipped. The redirect
// cases land on the map page, hence stubMapData + the service-worker block.
test.describe('Add Location — map-placed pin arrival', () => {
	test.use({ serviceWorkers: 'block' });

	test('valid coords render the confirmation state with a minimap linking back to the pin', async ({
		page
	}) => {
		await page.goto('/add-location?lat=52.52000&long=13.40500');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.getByText('Location picked on the map')).toBeVisible();
		// The minimap is a static preview wrapped in a link that reopens
		// placement mode with the crosshair on this pin.
		const adjust = page.getByRole('link', {
			name: 'Your pin from the map — click or tap to fine-tune'
		});
		await expect(adjust).toHaveAttribute(
			'href',
			'/map?add=adjust#17/52.52000/13.40500'
		);
		await expect(page.locator('.maplibregl-canvas')).toBeVisible();
		// No picker machinery: address search, coordinate inputs and map
		// controls are gone with the redirect guard.
		await expect(
			page.getByText('Search for an address', { exact: true })
		).toBeHidden();
		await expect(page.locator('#lat')).toHaveCount(0);
		await expect(page.locator('.maplibregl-ctrl-zoom-in')).toHaveCount(0);
	});

	test('plain /add-location is sent to placement mode', async ({ page }) => {
		await stubMapData(page);
		await page.goto('/add-location');

		await expect(page).toHaveURL(/\/map\?add=/);
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
	});

	test('malformed coords are sent to placement mode too', async ({ page }) => {
		await stubMapData(page);
		await page.goto('/add-location?lat=95&long=13.405');

		await expect(page).toHaveURL(/\/map\?add=/);
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
	});
});
