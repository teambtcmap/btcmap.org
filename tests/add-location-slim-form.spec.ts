import { expect, test } from '@playwright/test';

import { stubReverseGeocode } from './helpers';

// Step 2 of the add-location redesign: slim details form (#1134) —
// category picker and optional fields behind the "Add more details"
// expander. The page only opens with a map-placed pin (load guard), so
// every visit carries ?lat&long. The arrival address lookup (#1315) is
// stubbed to keep these hermetic; the SW block lets page.route see it.
const PIN = '/add-location?lat=52.52000&long=13.40500';

test.describe('Add Location — slim form', () => {
	test.use({ serviceWorkers: 'block' });

	test('category is a picker and Other reveals a required text input', async ({
		page
	}) => {
		await stubReverseGeocode(page);
		await page.goto(PIN);
		await page.waitForLoadState('domcontentloaded');

		const category = page.locator('#category');
		await expect(category).toBeVisible();
		// Taxonomy options present, no free-text field by default.
		await expect(category.locator('option[value="restaurants"]')).toHaveCount(1);
		await expect(page.locator('input[name="category-other"]')).toHaveCount(0);

		await category.selectOption('Other');
		const other = page.locator('input[name="category-other"]');
		await expect(other).toBeVisible();
		await expect(other).toHaveAttribute('required', '');
	});

	test('optional fields sit behind the expander and stay functional', async ({
		page
	}) => {
		await stubReverseGeocode(page);
		await page.goto(PIN);
		await page.waitForLoadState('domcontentloaded');

		const websiteInput = page.locator('input[name="website"]');
		await expect(websiteInput).toBeHidden();

		const toggle = page.getByRole('button', { name: /Add more details/ });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(websiteInput).toBeVisible();
		await websiteInput.fill('https://example.com');
		// Collapse again — the value survives because the group stays mounted.
		await toggle.click();
		await expect(websiteInput).toBeHidden();
		await toggle.click();
		await expect(websiteInput).toHaveValue('https://example.com');
	});

	test('opening hours unfold as a day grid and produce OSM syntax', async ({
		page
	}) => {
		await stubReverseGeocode(page);
		await page.goto(PIN);
		await page.waitForLoadState('domcontentloaded');

		// The editor sits behind its own accordion row inside the expander.
		await page.getByRole('button', { name: /Add more details/ }).click();
		const toggle = page.getByRole('button', { name: /Set opening hours/ });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await toggle.click();

		// Open Monday with the default 09:00–17:00 range.
		await page.getByRole('checkbox', { name: 'Monday' }).check();
		await expect(page.locator('#opening-hours-editor code')).toHaveText(
			'Mo 09:00-17:00'
		);

		// Clearing a time drops the day from the generated string — that
		// must be said out loud, not silent (#1317 review finding).
		const openingTime = page.getByLabel('Opening time');
		await openingTime.fill('');
		await expect(page.locator('#opening-hours-editor code')).toHaveText(
			'Not set'
		);
		await expect(
			page.getByText(/missing its opening or closing time/)
		).toBeVisible();
		await openingTime.fill('09:00');
		await expect(
			page.getByText(/missing its opening or closing time/)
		).toBeHidden();

		// The 24/7 shortcut overrides the grid.
		await page.getByRole('checkbox', { name: 'Open 24/7' }).check();
		await expect(page.locator('#opening-hours-editor code')).toHaveText('24/7');

		// Collapsing keeps the generated value visible as a summary.
		await toggle.click();
		await expect(page.locator('code', { hasText: '24/7' })).toBeVisible();
	});
});
