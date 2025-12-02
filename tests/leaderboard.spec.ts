import { expect, test } from '@playwright/test';

test.describe('Leaderboard pages', () => {
	test('communities leaderboard loads data when accessed directly', async ({ page }) => {
		// Navigate directly to the leaderboard (cold start, no prior data)
		await page.goto('/communities/leaderboard');

		// Wait for the table to load with data (gold medal in first position cell)
		// This confirms the data sync completed and table rendered
		await expect(page.getByRole('cell', { name: '🥇' })).toBeVisible({ timeout: 30000 });

		// Verify the header is present
		await expect(page.getByRole('heading', { name: /Community Leaderboard/ })).toBeVisible();
	});

	test('countries leaderboard loads data when accessed directly', async ({ page }) => {
		// Navigate directly to the leaderboard (cold start, no prior data)
		await page.goto('/countries/leaderboard');

		// Wait for the table to load with data (gold medal in first position cell)
		// This confirms the data sync completed and table rendered
		await expect(page.getByRole('cell', { name: '🥇' })).toBeVisible({ timeout: 30000 });

		// Verify the header is present
		await expect(page.getByRole('heading', { name: /Country Leaderboard/ })).toBeVisible();
	});
});
