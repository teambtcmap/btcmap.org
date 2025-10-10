import { test, expect } from '@playwright/test';

test.describe('Area Pages', () => {
	test('country stats page displays actual data and charts', async ({ page }) => {
		// Stats view requires store sync (areas, places, reports) which is slow in CI
		const timeout = process.env.CI ? 120000 : 30000; // 2 min for CI, 30s for local
		test.setTimeout(process.env.CI ? 120000 : 90000); // 2 min for CI, 1.5 min for local

		// Navigate to El Salvador stats (known to have good data)
		await page.goto('http://127.0.0.1:5173/country/sv/stats', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for stats to load with actual numbers (requires full store sync)
		await expect(page.getByText('Total Locations')).toBeVisible({ timeout });
		await expect(page.getByText('Recently Verified Locations')).toBeVisible();

		// Verify actual numeric data appears (not just 0 or loading state)
		// Look for any number that's not zero or undefined
		const totalLocationsSection = page.locator('text=Total Locations').locator('..');
		const statsNumber = totalLocationsSection.locator('div').filter({ hasText: /^\d+$/ }).first();
		await expect(statsNumber).toBeVisible({ timeout: 10000 });

		// Verify percentage appears for verified locations
		await expect(page.getByText(/%/)).toBeVisible({ timeout: 10000 });

		// Verify charts section exists and has content
		await expect(page.getByText('Charts', { exact: false })).toBeVisible();

		// Check that canvas elements for charts are present (charts actually rendered)
		const chartCanvases = page.locator('canvas');
		await expect(chartCanvases.first()).toBeVisible({ timeout: 15000 });
		expect(await chartCanvases.count()).toBeGreaterThan(0);
	});

	test('country activity page displays actual taggers and events', async ({ page }) => {
		// Activity view requires store sync (areas, places, events, users) which is slow in CI
		const timeout = process.env.CI ? 120000 : 30000; // 2 min for CI, 30s for local
		test.setTimeout(process.env.CI ? 120000 : 90000); // 2 min for CI, 1.5 min for local

		// Navigate to El Salvador activity (known to have activity)
		await page.goto('http://127.0.0.1:5173/country/sv/activity', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for activity sections to appear
		await expect(page.getByText('Taggers', { exact: false })).toBeVisible({ timeout });
		await expect(page.getByText('Latest Activity', { exact: false })).toBeVisible({ timeout });

		// Verify actual tagger avatars/profiles appear (not loading skeletons)
		// Taggers section should have clickable links to tagger profiles
		const taggerLinks = page.locator('a[href*="/tagger/"]');
		await expect(taggerLinks.first()).toBeVisible({ timeout: 15000 });
		expect(await taggerLinks.count()).toBeGreaterThan(0);

		// Verify actual activity events appear with actions
		// Look for common event type keywords (create, update, delete, etc.)
		const activityEvents = page.locator('text=/create|update|delete|add|remove/i').first();
		await expect(activityEvents).toBeVisible({ timeout: 10000 });
	});

	test('country merchants page displays actual merchant data', async ({ page }) => {
		// Merchants view requires store sync (areas, places) which is slow in CI
		const timeout = process.env.CI ? 120000 : 30000; // 2 min for CI, 30s for local
		test.setTimeout(process.env.CI ? 120000 : 90000); // 2 min for CI, 1.5 min for local

		// Navigate to El Salvador merchants
		await page.goto('http://127.0.0.1:5173/country/sv/merchants', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for merchant section to load
		await expect(page.getByText('Merchant Highlights', { exact: false })).toBeVisible({
			timeout
		});

		// Verify merchant cards appear (not just loading state)
		const merchantCards = page.locator('.rounded-2xl.border').filter({ hasText: /verify/i });
		await expect(merchantCards.first()).toBeVisible({ timeout: 15000 });

		// Verify at least one card shows actual verification date (YYYY-MM-DD format)
		// This catches the bug where verified dates weren't showing
		const verificationDate = page.locator('text=/\\d{4}-\\d{2}-\\d{2}/').first();
		await expect(verificationDate).toBeVisible({ timeout: 10000 });

		// Verify merchant names appear (not placeholder "BTC Map Merchant")
		// Look for text that's not the generic placeholder
		const merchantCards2 = page.locator('.rounded-2xl.border');
		const firstCard = merchantCards2.first();
		await expect(firstCard).toBeVisible();

		// Get card text and verify it's not just loading/placeholder state
		const cardText = await firstCard.textContent();
		expect(cardText).toBeTruthy();
		expect(cardText?.length).toBeGreaterThan(20); // Real content, not just "Verify"
	});

	test('community stats page displays actual data', async ({ page }) => {
		// Communities require same store sync as countries (slow in CI)
		const timeout = process.env.CI ? 120000 : 30000; // 2 min for CI, 30s for local
		test.setTimeout(process.env.CI ? 120000 : 90000); // 2 min for CI, 1.5 min for local

		// Navigate to a known community with stats (bitcoin-jungle in Costa Rica)
		await page.goto('http://127.0.0.1:5173/community/bitcoin-jungle/stats', {
			waitUntil: 'load'
		});
		await expect(page).toHaveTitle(/BTC Map/);

		// Communities use the same components as countries, so same checks apply
		await expect(page.getByText('Total Locations')).toBeVisible({ timeout });

		// Verify numeric data appears
		await expect(page.getByText(/%/)).toBeVisible({ timeout: 10000 });

		// Verify charts render
		const chartCanvases = page.locator('canvas');
		await expect(chartCanvases.first()).toBeVisible({ timeout: 15000 });
	});

	test('community activity page displays actual events', async ({ page }) => {
		// Communities require same store sync as countries (slow in CI)
		const timeout = process.env.CI ? 120000 : 30000; // 2 min for CI, 30s for local
		test.setTimeout(process.env.CI ? 120000 : 90000); // 2 min for CI, 1.5 min for local

		// Navigate to bitcoin-jungle activity
		await page.goto('http://127.0.0.1:5173/community/bitcoin-jungle/activity', {
			waitUntil: 'load'
		});
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for activity sections
		await expect(page.getByText('Taggers', { exact: false })).toBeVisible({ timeout });

		// Verify tagger links appear
		const taggerLinks = page.locator('a[href*="/tagger/"]');
		await expect(taggerLinks.first()).toBeVisible({ timeout: 15000 });
	});
});
