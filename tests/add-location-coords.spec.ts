import { expect, test } from '@playwright/test';

test.describe('Add Location — manual coordinate entry', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/add-location');
		await page.waitForLoadState('domcontentloaded');
		// The Leaflet/MapLibre deps load async on mount. Wait for the
		// map container to render so placeMarker() doesn't no-op.
		await expect(page.locator('.leaflet-container')).toBeVisible();
		await expect(page.locator('.leaflet-control-zoom')).toBeVisible();
	});

	test('advanced section is collapsed by default', async ({ page }) => {
		const toggle = page.getByRole('button', {
			name: /Advanced — enter coordinates manually/
		});
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('#manual-coords')).toHaveCount(0);
	});

	test('typing valid coords drops a marker and shows "Location selected"', async ({
		page
	}) => {
		const toggle = page.getByRole('button', {
			name: /Advanced — enter coordinates manually/
		});
		await toggle.click();

		const section = page.locator('#manual-coords');
		await expect(section).toBeVisible();

		// Berlin
		await section.getByLabel('Latitude').fill('52.5200');
		await section.getByLabel('Longitude').fill('13.4050');

		await expect(page.getByText('Location selected!')).toBeVisible();
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
	});

	test('out-of-range latitude shows inline error', async ({ page }) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		const section = page.locator('#manual-coords');
		await section.getByLabel('Latitude').fill('95');

		await expect(
			section.getByText('Latitude must be a number between -90 and 90.')
		).toBeVisible();
		await expect(section.getByLabel('Latitude')).toHaveAttribute(
			'aria-invalid',
			'true'
		);
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
	});

	test('out-of-range longitude shows inline error', async ({ page }) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		const section = page.locator('#manual-coords');
		await section.getByLabel('Latitude').fill('52.52');
		await section.getByLabel('Longitude').fill('-200');

		await expect(
			section.getByText('Longitude must be a number between -180 and 180.')
		).toBeVisible();
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
	});

	test('non-numeric input shows error', async ({ page }) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		const section = page.locator('#manual-coords');
		await section.getByLabel('Latitude').fill('not a number');

		await expect(
			section.getByText('Latitude must be a number between -90 and 90.')
		).toBeVisible();
	});

	test('reopening section after entering coords prefills the inputs', async ({
		page
	}) => {
		const toggle = page.getByRole('button', {
			name: /Advanced — enter coordinates manually/
		});
		await toggle.click();

		const section = page.locator('#manual-coords');
		await section.getByLabel('Latitude').fill('52.5200');
		await section.getByLabel('Longitude').fill('13.4050');
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);

		// close
		await toggle.click();
		await expect(section).toHaveCount(0);

		// reopen — values should be prefilled from lat/long state
		await toggle.click();
		await expect(section.getByLabel('Latitude')).toHaveValue('52.52000');
		await expect(section.getByLabel('Longitude')).toHaveValue('13.40500');
	});
});
