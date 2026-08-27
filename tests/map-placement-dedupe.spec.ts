import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { stubMapData, waitForMarkersToLoad } from './helpers';

// Step 3 of the add-location redesign (#1134): confirming a placement pin
// near existing places interrupts with a duplicate check before the form.
// Hermetic via stubMapData — Stub Cafe (~6 m from the shared viewport
// center) is the only STUB_PLACES entry inside the 75 m radius.
test.describe('Placement dedupe interrupt', () => {
	test.use({ serviceWorkers: 'block' });

	const startPlacement = async (page: Page) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
		await page.getByRole('button', { name: /^menu$/i }).click();
		await page.getByRole('button', { name: 'Add location' }).click();
		await expect(page.getByText('Place the pin')).toBeVisible();
	};

	test('confirm near an existing place shows the interrupt; Back returns', async ({
		page
	}) => {
		await stubMapData(page);
		await startPlacement(page);

		await page.getByRole('button', { name: 'Add a place here' }).click();
		await expect(page.getByText('Is it one of these?')).toBeVisible();
		// Only the in-radius candidate is listed, linked to its merchant page.
		const candidate = page.getByRole('link', { name: /Stub Cafe/ });
		await expect(candidate).toHaveAttribute('href', '/merchant/1');
		await expect(page.getByRole('link', { name: /Stub Shop/ })).toHaveCount(0);
		// No navigation happened yet.
		await expect(page).toHaveURL(/\/map/);

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByText('Place the pin')).toBeVisible();
		await expect(page.getByText('Is it one of these?')).toBeHidden();
	});

	test('add-anyway continues to the form with the pin coords', async ({
		page
	}) => {
		await stubMapData(page);
		await startPlacement(page);

		await page.getByRole('button', { name: 'Add a place here' }).click();
		await page
			.getByRole('button', { name: 'None of these — add a new place' })
			.click();
		await expect(page).toHaveURL(/\/add-location\?lat=42\.27\d+&long=42\.70\d+/);
	});

	test('no nearby places goes straight to the form', async ({ page }) => {
		// One stub place far outside the radius — markers load, no candidates.
		await stubMapData(page, [
			{ id: 9, lat: 42.3, lon: 42.75, icon: 'cafe', name: 'Far Place' }
		]);
		await startPlacement(page);

		await page.getByRole('button', { name: 'Add a place here' }).click();
		await expect(page).toHaveURL(/\/add-location\?lat=42\.27\d+&long=42\.70\d+/);
	});
});
