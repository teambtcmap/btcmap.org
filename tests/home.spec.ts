import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
	test('opens map and checks for console errors', async ({ page }) => {
		const errors: Error[] = [];
		page.on('pageerror', (exception) => {
			console.error(`Uncaught exception: "${exception}"`);
			errors.push(exception);
		});

		await page.goto('http://127.0.0.1:5173');
		await expect(page).toHaveTitle(/BTC Map/);

		await page.getByRole('link', { name: 'Open Map' }).click();
		await expect(page).toHaveURL(/map/);

		// Check if the zoom-in button is visible (aka map is actually loaded and visible)
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Assert that no errors were thrown
		expect(errors.length).toBe(0);
	});

	test('add location opens', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173');

		await page.waitForLoadState('domcontentloaded');

		const heading = page.getByRole('heading', {
			name: 'Find places to spend sats wherever you are.'
		});
		await heading.waitFor({ state: 'visible' });
		await expect(heading).toBeTruthy();

		await page.getByRole('link', { name: 'Add Location' }).click();

		await expect(page.getByRole('heading', { name: 'Accept bitcoin? Get found.' })).toBeTruthy();
	});
});
