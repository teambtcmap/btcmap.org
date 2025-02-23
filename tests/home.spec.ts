import { test, expect } from '@playwright/test';

test('open map', async ({ page }) => {
	await page.goto('http://127.0.0.1:5173');

	await expect(page).toHaveTitle(/BTC Map/);

	await page.getByRole('link', { name: 'Open Map' }).click();
	await expect(page).toHaveURL(/map/);
});

test('add location', async ({ page }) => {
	await page.goto('http://127.0.0.1:5173');

	await page.waitForLoadState('domcontentloaded');

	const heading = page.getByRole('heading', {
		name: 'Easily find places to spend sats anywhere on the planet.'
	});
	await heading.waitFor({ state: 'visible' });
	await expect(heading).toBeTruthy();

	await page.getByRole('button', { name: 'Contribute' }).click();

	await page.getByRole('link', { name: 'Add Location' }).click();

	await expect(page.getByRole('heading', { name: 'Accept bitcoin? Get found.' })).toBeTruthy();
});
