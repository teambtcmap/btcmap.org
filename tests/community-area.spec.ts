import { test, expect } from '@playwright/test';

test.describe('Community Area Pages', () => {
	test('loads community page and redirects to merchants', async ({ page }) => {
		// Reasonable timeout - focus on navigation, not heavy data loading
		test.setTimeout(60000);

		// Navigate directly to a known community (Bitcoin Jungle Costa Rica)
		await page.goto('http://127.0.0.1:5173/community/bitcoin-jungle-cr');
		await expect(page).toHaveURL(/\/community\/bitcoin-jungle-cr\/merchants$/);
		await page.waitForLoadState('domcontentloaded');

		// Verify basic page structure loads (before heavy API data)
		const bodyContent = await page.locator('body').textContent();
		expect(bodyContent).toBeTruthy();
		expect(bodyContent!.length).toBeGreaterThan(100);
	});

	test('handles section navigation', async ({ page }) => {
		// Reasonable timeout - focus on navigation, not heavy data loading
		test.setTimeout(60000);

		const testSections = ['merchants', 'stats', 'activity', 'maintain'];

		for (const section of testSections) {
			await page.goto(`http://127.0.0.1:5173/community/bitcoin-jungle-cr/${section}`);

			// Verify URL matches
			await expect(page).toHaveURL(new RegExp(`/community/bitcoin-jungle-cr/${section}$`));

			// Don't wait for heavy data loading - just verify navigation works
			await page.waitForLoadState('domcontentloaded');
		}
	});
});
