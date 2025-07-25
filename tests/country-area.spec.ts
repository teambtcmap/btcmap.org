import { test, expect } from '@playwright/test';

test.describe('Country Area Pages', () => {
	test('loads country page and redirects to merchants', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/country/za');
		await expect(page).toHaveURL(/\/country\/za\/merchants$/);
		await page.waitForLoadState('networkidle');

		const pageTitle = await page.title();
		expect(pageTitle).toContain('South Africa');

		const bodyContent = await page.locator('body').textContent();
		expect(bodyContent).toBeTruthy();
		expect(bodyContent!.length).toBeGreaterThan(100);
	});

	test('handles section navigation', async ({ page }) => {
		const testSections = ['merchants', 'stats', 'activity', 'maintain'];

		for (const section of testSections) {
			await page.goto(`http://127.0.0.1:5173/country/za/${section}`);
			await page.waitForLoadState('networkidle');
			await expect(page).toHaveURL(new RegExp(`/country/za/${section}$`));
		}
	});
});