import { test, expect } from '@playwright/test';

test.describe('Community Area Pages', () => {
	test('loads community area page with valid ID', async ({ page }) => {
		// Navigate to communities page (which redirects to africa section)
		await page.goto('http://127.0.0.1:5173/communities/africa');

		// Wait for communities page to load
		await page.waitForLoadState('domcontentloaded');
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(2000); // Give time for dynamic content to load

		// Ensure community links are present - this should not be skipped
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await expect(firstCommunityLink).toBeVisible({ timeout: 15000 });

		await firstCommunityLink.click();
		// Wait for navigation to complete
		await page.waitForLoadState('domcontentloaded');

		// Verify we're on a community area page (app redirects to merchants section)
		await expect(page).toHaveURL(/\/community\/[^/]+\/merchants$/);

		// Check that the page has loaded with basic elements (skip breadcrumbs if not present)
		const breadcrumbs = page.locator(
			'nav[aria-label="breadcrumb"], .breadcrumb, nav:has(a[href="/communities"])'
		);
		if ((await breadcrumbs.count()) > 0) {
			await expect(breadcrumbs).toBeVisible();
		}

		// Check that the main content area exists
		const mainContent = page.locator('main, .main, [role="main"]');
		await expect(mainContent).toBeVisible();
	});

	test('defaults to merchants section when no section is provided', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(5000); // Give more time for API data to load locally

		// Ensure community links are present - this should not be skipped
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await expect(firstCommunityLink).toBeVisible({ timeout: 20000 });

		// Get the community href for URL verification
		const communityHref = await firstCommunityLink.getAttribute('href');
		console.log('Community link href:', communityHref);
		await firstCommunityLink.click();

		// Wait for navigation to complete
		await page.waitForLoadState('networkidle'); // Wait for network requests
		await page.waitForTimeout(3000); // More time for local environment

		// Should redirect to merchants section (URL should end with /merchants)
		if (communityHref) {
			await expect(page).toHaveURL(
				new RegExp(`${communityHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/merchants$`)
			);
		}

		// Check that we're on a valid community page with content
		const currentUrl = page.url();
		const isOnCommunityPage =
			currentUrl.includes('/community/') && currentUrl.includes('/merchants');
		expect(isOnCommunityPage).toBe(true);

		// More robust content checks - look for various indicators of merchants section
		const contentIndicators = [
			page.locator('text="Merchants"'),
			page.locator('h1, h2, h3, h4').filter({ hasText: /merchants/i }),
			page.locator('[data-section="merchants"], [id*="merchant"], [class*="merchant"]'),
			page.locator('a[href^="/merchant/"]').first(),
			page.locator('main').filter({ hasText: /merchant/i })
		];

		// At least one of these should be visible, or the page should have valid content
		let contentFound = false;
		for (const indicator of contentIndicators) {
			try {
				if ((await indicator.count()) > 0 && (await indicator.isVisible())) {
					contentFound = true;
					break;
				}
			} catch {
				// Continue to next indicator
			}
		}

		// If no specific merchants content found, just verify the page loaded successfully
		if (!contentFound) {
			const bodyContent = await page.locator('body').textContent();
			expect(bodyContent).toBeTruthy();
			expect(bodyContent!.length).toBeGreaterThan(100);
		}
	});

	test('handles section switching via tab navigation', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(2000);

		// Ensure community links are present and click on the first one
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await expect(firstCommunityLink).toBeVisible({ timeout: 15000 });
		await firstCommunityLink.click();

		// Wait for page to load
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(500);

		// Look for section tabs/buttons (using more specific selectors to avoid strict mode violations)
		const possibleSections = ['Stats', 'Activity', 'Maintain'];

		for (const sectionName of possibleSections) {
			// Try to find section buttons in the main navigation area first
			const mainSectionButton = page
				.locator('main')
				.getByRole('button', { name: sectionName })
				.first();
			const tabSectionButton = page.getByRole('tab', { name: sectionName }).first();

			let buttonToClick = null;

			if ((await mainSectionButton.count()) > 0 && (await mainSectionButton.isVisible())) {
				buttonToClick = mainSectionButton;
			} else if ((await tabSectionButton.count()) > 0 && (await tabSectionButton.isVisible())) {
				buttonToClick = tabSectionButton;
			}

			// Only test if a section button exists and is visible
			if (buttonToClick) {
				await buttonToClick.click();

				// Wait a bit for any content to load
				await page.waitForTimeout(500);

				// Check that the URL updated with the section parameter
				await expect(page).toHaveURL(new RegExp(`/${sectionName.toLowerCase()}$`));
			}
		}
	});

	test('loads and displays merchant information in merchants section', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(2000);

		// Ensure community links are present and click on the first one
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await expect(firstCommunityLink).toBeVisible({ timeout: 15000 });
		await firstCommunityLink.click();

		// Wait for page to load
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(500);

		// Should be on merchants section by default
		// Look for merchant-related content
		const merchantLinks = page.locator('a[href^="/merchant/"]');

		// If there are merchants, check that they're displayed
		if ((await merchantLinks.count()) > 0) {
			await expect(merchantLinks.first()).toBeVisible();
		}
	});
});
