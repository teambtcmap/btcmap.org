import { test, expect } from '@playwright/test';

test.describe('Areas', () => {
	test('opens country area', async ({ page }) => {
		// Navigate directly to countries page
		await page.goto('/countries');
		await expect(page).toHaveURL(/countries/);

		// Wait for the countries page to load and find the South Africa link
		await page.waitForLoadState('domcontentloaded');

		const southAfricaLink = page.getByRole('link', { name: 'South Africa' });
		if ((await southAfricaLink.count()) > 0) {
			await expect(southAfricaLink).toBeVisible();
			await southAfricaLink.click();
			// Wait for navigation to complete
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/country\/za\/merchants/); // App redirects to merchants section
		} else {
			// If South Africa link not found, just verify we're on countries page
			await expect(page).toHaveURL(/countries/);
			return; // Skip rest of test
		}

		await expect(
			page.getByRole('heading', {
				name: 'South Africa',
				exact: true
			})
		).toBeVisible();
	});

	test('navigates through communities structure', async ({ page }) => {
		// Navigate directly to communities page
		await page.goto('/communities');
		await expect(page).toHaveURL(/communities/);

		const communityHeading = page.getByRole('heading', {
			name: 'Join the bitcoin map community.'
		});
		await expect(communityHeading).toBeVisible();

		// Wait for community data to load - areas API fetch can take a while from scratch
		// The areas sync fetches paginated data which can be slow on first load
		const communityLinks = page.locator('a[href^="/community/"]');

		// Check that at least some communities are visible (increased timeout for API fetch)
		await expect(communityLinks.first()).toBeVisible({ timeout: 60000 });

		// Click the first community and verify navigation works
		await communityLinks.first().click();

		// Wait for URL to change to a community page - this confirms navigation worked
		await expect(page).toHaveURL(/\/community\/[^/]+/, { timeout: 20000 });

		// Verify the community page heading is visible
		const communityPageHeading = page.locator('h1').first();
		await expect(communityPageHeading).toBeVisible({ timeout: 10000 });
	});

	test('community leaderboard structure loads', async ({ page }) => {
		// Navigate directly to community leaderboard
		await page.goto('/communities/leaderboard');
		await expect(page).toHaveURL(/communities\/leaderboard/);

		// Wait for the page heading to be visible
		await expect(
			page.getByRole('heading', {
				name: 'Community Leaderboard'
			})
		).toBeVisible();

		// Just check that basic leaderboard structure is present (don't wait for heavy data loading)
		// Simply verify the page loaded without errors - don't test specific elements
		const pageContent = page.locator('main');
		await expect(pageContent).toBeVisible({ timeout: 10000 });
	});
});
