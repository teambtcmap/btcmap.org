import { expect, test } from '@playwright/test';

test.describe('Leaderboard pages', () => {
	test('communities leaderboard loads data when accessed directly', async ({ page }) => {
		// Navigate directly to the leaderboard (cold start, no prior data)
		await page.goto('/communities/leaderboard');

		// Wait for the leaderboard count to appear in the header (indicates data loaded)
		await expect(page.getByText(/Community Leaderboard \(\d+\)/)).toBeVisible({ timeout: 30000 });

		// Verify the table has loaded with at least one row (gold medal in desktop table cell)
		await expect(page.getByRole('cell', { name: '🥇' })).toBeVisible();
	});

	test('countries leaderboard loads data when accessed directly', async ({ page }) => {
		// Navigate directly to the leaderboard (cold start, no prior data)
		await page.goto('/countries/leaderboard');

		// Wait for the leaderboard count to appear in the header (indicates data loaded)
		await expect(page.getByText(/Country Leaderboard \(\d+\)/)).toBeVisible({ timeout: 30000 });

		// Verify the table has loaded with at least one row (gold medal in desktop table cell)
		await expect(page.getByRole('cell', { name: '🥇' })).toBeVisible();
	});
});
