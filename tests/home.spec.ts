import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
	test('add location opens', async ({ page }) => {
		await page.goto('');

		await page.waitForLoadState('domcontentloaded');

		const heading = page.getByRole('heading', {
			name: 'Find places to spend sats wherever you are.'
		});
		await expect(heading).toBeVisible();

		await page.getByRole('link', { name: 'Add Location' }).click();

		await expect(page.getByRole('heading', { name: 'Accept bitcoin? Get found.' })).toBeVisible();
	});
});
