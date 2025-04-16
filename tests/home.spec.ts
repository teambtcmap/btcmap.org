import { test, expect } from '@playwright/test';
import { describe } from 'node:test';

describe('Home Page', () => {
	test('opens map and checks for console errors', async ({ page }) => {
		const errors: Error[] = [];
		page.on('pageerror', (exception) => {
			// Log the error to see it in the test output
			console.error(`Browser Page Error: "${exception}"`);
			errors.push(exception);
		});

		await page.goto('http://127.0.0.1:5173');
		await expect(page).toHaveTitle(/BTC Map/);

		await page.getByRole('link', { name: 'Open Map' }).click();

		// Wait for a known element on the map page to ensure navigation occurred
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible({ timeout: 10000 }); // Wait up to 10s for map element

		// Wait for network requests to finish after navigation and initial render
		// This gives more time for potential errors to occur and be caught
		await page.waitForLoadState('networkidle', { timeout: 5000 }); // Wait up to 5s for network idle

		// Check the URL after waiting
		await expect(page).toHaveURL(/map/);

		// Assert that no errors were thrown.
		// If errors occur (as seen in UI mode), this assertion should now fail more reliably.
		expect(
			errors.length,
			`Expected no console errors, but found ${errors.length}: ${errors.join(', ')}`
		).toBe(0);
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
