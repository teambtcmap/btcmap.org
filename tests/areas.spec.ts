import { test, expect } from '@playwright/test';
import { describe } from 'node:test';

describe('Areas', () => {
	test('opens country area', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173');

		const heading = page.getByRole('heading', {
			name: 'Find places to spend sats wherever you are.'
		});
		await heading.waitFor({ state: 'visible' });
		await expect(heading).toBeTruthy();

		await page.getByRole('button', { name: 'Areas' }).click();
		await page.getByRole('link', { name: 'Countries' }).click();
		await expect(page).toHaveURL(/countries/);

		await page.getByRole('link', { name: 'South Africa' }).click();
		await expect(page).toHaveURL(/country\/za/);

		await page
			.getByRole('heading', {
				name: 'South Africa',
				exact: true
			})
			.waitFor({ state: 'visible' });
	});
});
