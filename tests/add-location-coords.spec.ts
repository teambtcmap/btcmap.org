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

	test('lat/long inputs are read-only by default', async ({ page }) => {
		await expect(page.getByLabel('Latitude')).toHaveAttribute('readonly', '');
		await expect(page.getByLabel('Longitude')).toHaveAttribute('readonly', '');
		const toggle = page.getByRole('button', {
			name: /Advanced — enter coordinates manually/
		});
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});

	test('toggling advanced mode makes the existing fields editable', async ({
		page
	}) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		await expect(page.getByLabel('Latitude')).not.toHaveAttribute(
			'readonly',
			''
		);
		await expect(page.getByLabel('Longitude')).not.toHaveAttribute(
			'readonly',
			''
		);
	});

	test('typing valid coords drops a marker and shows "Location selected"', async ({
		page
	}) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		// Berlin
		await page.getByLabel('Latitude').fill('52.5200');
		await page.getByLabel('Longitude').fill('13.4050');

		await expect(page.getByText('Location selected!')).toBeVisible();
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
	});

	test('out-of-range latitude shows inline error', async ({ page }) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		await page.getByLabel('Latitude').fill('95');

		await expect(
			page.getByText('Latitude must be a number between -90 and 90.')
		).toBeVisible();
		await expect(page.getByLabel('Latitude')).toHaveAttribute(
			'aria-invalid',
			'true'
		);
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
	});

	test('out-of-range longitude shows inline error', async ({ page }) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		await page.getByLabel('Latitude').fill('52.52');
		await page.getByLabel('Longitude').fill('-200');

		await expect(
			page.getByText('Longitude must be a number between -180 and 180.')
		).toBeVisible();
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
	});

	test('non-numeric input shows error', async ({ page }) => {
		await page
			.getByRole('button', { name: /Advanced — enter coordinates manually/ })
			.click();

		await page.getByLabel('Latitude').fill('not a number');

		await expect(
			page.getByText('Latitude must be a number between -90 and 90.')
		).toBeVisible();
	});

	test('exiting advanced mode keeps the entered coords visible', async ({
		page
	}) => {
		const toggle = page.getByRole('button', {
			name: /Advanced — enter coordinates manually/
		});
		await toggle.click();

		await page.getByLabel('Latitude').fill('52.5200');
		await page.getByLabel('Longitude').fill('13.4050');
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);

		// Close advanced — fields go back to read-only but keep the values.
		await toggle.click();
		await expect(page.getByLabel('Latitude')).toHaveAttribute('readonly', '');
		await expect(page.getByLabel('Latitude')).toHaveValue('52.52000');
		await expect(page.getByLabel('Longitude')).toHaveValue('13.40500');
		// Marker still on the map.
		await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
	});
});
