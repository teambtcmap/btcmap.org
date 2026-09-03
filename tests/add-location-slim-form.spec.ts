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
});
