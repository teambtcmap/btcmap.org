import { test, expect } from '@playwright/test';
import { describe } from 'node:test';

describe('Home Page', () => {
	test('opens map', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173');

		await expect(page).toHaveTitle(/BTC Map/);

		await page.getByRole('link', { name: 'Open Map' }).click();
		await expect(page).toHaveURL(/map/);
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
