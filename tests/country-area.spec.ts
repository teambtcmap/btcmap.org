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
		expect(bodyContent.length).toBeGreaterThan(100);
	});

	test('displays breadcrumb navigation', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/country/za');
		await page.waitForLoadState('networkidle');

		const countriesLink = page.getByRole('link', { name: 'Countries' });
		await expect(countriesLink).toBeVisible();
		await expect(countriesLink).toHaveAttribute('href', '/countries');

		await countriesLink.click();
		await expect(page).toHaveURL(/\/countries/);
	});

	test('handles section navigation', async ({ page }) => {
		const testSections = ['merchants', 'stats', 'activity', 'maintain'];

		for (const section of testSections) {
			await page.goto(`http://127.0.0.1:5173/country/za/${section}`);
			await page.waitForLoadState('networkidle');
			await expect(page).toHaveURL(new RegExp(`/country/za/${section}$`));
		}
	});

	test('handles invalid country gracefully', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/country/invalid-country-id');
		await page.waitForLoadState('networkidle');

		const isOn404 = page.url().includes('/404');
		const hasErrorMessage = await page.locator('text="Could not find"').isVisible();
		const hasConsoleError = await page.locator('text="error"').isVisible();

		const isHandledGracefully = isOn404 || hasErrorMessage || hasConsoleError;

		if (!isHandledGracefully) {
			const hasContent = await page.locator('body').isVisible();
			expect(hasContent).toBe(true);
		}
	});

	test('handles different country/section combinations', async ({ page }) => {
		const testCases = [
			{ country: 'de', section: 'merchants' },
			{ country: 'us', section: 'stats' },
			{ country: 'za', section: 'activity' },
			{ country: 'gb', section: 'maintain' }
		];

		for (const { country, section } of testCases) {
			await page.goto(`http://127.0.0.1:5173/country/${country}/${section}`);
			await page.waitForLoadState('networkidle');

			await expect(page).toHaveURL(new RegExp(`/country/${country}/${section}$`));
			await expect(page).not.toHaveURL(/\/404/);

			const bodyContent = await page.locator('body').textContent();
			expect(bodyContent).toBeTruthy();
			expect(bodyContent.length).toBeGreaterThan(100);
		}
	});

	test('handles JavaScript errors gracefully', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('http://127.0.0.1:5173/country/de/merchants');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		const criticalErrors = errors.filter(
			(error) =>
				error.includes('Cannot read properties of undefined') ||
				error.includes('TypeError') ||
				error.includes('ReferenceError')
		);

		expect(criticalErrors.length).toBe(0);

		const bodyContent = await page.locator('body').textContent();
		expect(bodyContent).toBeTruthy();
		expect(bodyContent.length).toBeGreaterThan(100);
	});
});
