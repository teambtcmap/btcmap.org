import { expect, test } from '@playwright/test';

// Step 2 of the add-location redesign: slim details form (#1134) —
// category picker, coordinate fields hidden for map-placed pins, and
// optional fields behind the "Add more details" expander.
test.describe('Add Location — slim form', () => {
	test('category is a picker and Other reveals a required text input', async ({
		page
	}) => {
		await page.goto('/add-location');
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

	test('map-placed pins hide the coordinate fields; escape hatch restores them', async ({
		page
	}) => {
		await page.goto('/add-location?lat=52.52000&long=13.40500');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('#lat')).toBeHidden();
		await expect(
			page.getByRole('button', { name: /Advanced — enter coordinates manually/ })
		).toBeHidden();

		await page
			.getByRole('button', { name: 'Search for an address instead' })
			.click();
		await expect(page.locator('#lat')).toBeVisible();
	});

	test('optional fields sit behind the expander and stay functional', async ({
		page
	}) => {
		await page.goto('/add-location');
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
