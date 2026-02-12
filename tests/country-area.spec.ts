import { test, expect } from '@playwright/test';

test.describe('Country Area Pages', () => {
	test('loads country page and redirects to merchants', async ({ page }) => {
		// Increase timeout for this slow test due to heavy API calls
		test.setTimeout(60000);

		await page.goto('/country/za');
		await expect(page).toHaveURL(/\/country\/za\/merchants$/);
		await page.waitForLoadState('domcontentloaded');

		const pageTitle = await page.title();
		expect(pageTitle).toContain('South Africa');

		// Verify page heading is visible
		await expect(page.getByRole('heading', { name: 'South Africa', exact: true })).toBeVisible();
	});

	test('handles section navigation', async ({ page }) => {
		// Reasonable timeout - focus on navigation, not heavy data loading
		test.setTimeout(60000);

		const testSections = ['merchants', 'stats', 'activity', 'maintain'];

		for (const section of testSections) {
			await page.goto(`/country/za/${section}`);

			// Verify URL matches
			await expect(page).toHaveURL(new RegExp(`/country/za/${section}$`));

			// Verify basic page structure loads (before heavy API calls)
			await page.waitForSelector('h1:has-text("South Africa")', { timeout: 20000 });
			await page.waitForSelector(
				`button:has-text("${section.charAt(0).toUpperCase() + section.slice(1)}")`,
				{ timeout: 10000 }
			);

			// For merchants, verify the section content starts loading
			if (section === 'merchants') {
				await page.waitForSelector('h3:has-text("South Africa Map")', { timeout: 10000 });
			}

			// Don't wait for heavy data loading - just verify navigation works
			await page.waitForLoadState('domcontentloaded');
		}
	});
});
