import { expect, test } from '@playwright/test';

// Arrival state for pins handed over from the map's placement mode (#1134):
// valid ?lat&long swaps the marketing hero for a confirmation banner and
// labels the mini-map as the picked pin instead of asking the user to search.
test.describe('Add Location — map-placed pin arrival', () => {
	test('valid coords render the confirmation state with a marker', async ({
		page
	}) => {
		await page.goto('/add-location?lat=52.52000&long=13.40500');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.getByText('Location picked on the map')).toBeVisible();
		// The marketing hero gives way to the banner.
		await expect(page.getByText('Accept bitcoin? Get found')).toBeHidden();
		await expect(
			page.getByText('Your pin from the map — click or tap to fine-tune')
		).toBeVisible();
		await expect(
			page.getByText('Search for an address', { exact: true })
		).toBeHidden();

		// Handover synced the coordinate inputs…
		await expect(page.getByLabel('Latitude')).toHaveValue('52.52000');
		await expect(page.getByLabel('Longitude')).toHaveValue('13.40500');
		// …and once the picker map is up, the owed marker lands on it.
		await expect(page.locator('.maplibregl-ctrl-zoom-in')).toBeVisible();
		await expect(page.locator('.maplibregl-marker')).toHaveCount(1);

		// Escape hatch restores the default search-first layout.
		await page
			.getByRole('button', { name: 'Search for an address instead' })
			.click();
		await expect(
			page.getByText('Search for an address', { exact: true })
		).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Search for an address instead' })
		).toBeHidden();
	});

	test('plain /add-location keeps the default layout', async ({ page }) => {
		await page.goto('/add-location');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.getByText('Accept bitcoin? Get found')).toBeVisible();
		await expect(page.getByText('Location picked on the map')).toBeHidden();
		await expect(
			page.getByText('Search for an address', { exact: true })
		).toBeVisible();
	});
});
