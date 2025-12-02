import { expect, test } from '@playwright/test';

test.describe('Leaderboard pages', () => {
	test('communities leaderboard loads data when accessed directly', async ({ page }) => {
		// Navigate directly to the leaderboard (cold start, no prior data)
		await page.goto('/communities/leaderboard');

		// Wait for the leaderboard table to appear with actual data
		// The table should have at least one row with position data (🥇 for first place)
		const firstPosition = page.locator('text=🥇');
		await expect(firstPosition).toBeVisible({ timeout: 30000 });

		// Verify the leaderboard count is shown in the header
		await expect(page.getByText(/Community Leaderboard \(\d+\)/)).toBeVisible();
	});

	test('countries leaderboard loads data when accessed directly', async ({ page }) => {
		// Navigate directly to the leaderboard (cold start, no prior data)
		await page.goto('/countries/leaderboard');

		// Wait for the leaderboard table to appear with actual data
		const firstPosition = page.locator('text=🥇');
		await expect(firstPosition).toBeVisible({ timeout: 30000 });

		// Verify the leaderboard count is shown in the header
		await expect(page.getByText(/Country Leaderboard \(\d+\)/)).toBeVisible();
	});
});
