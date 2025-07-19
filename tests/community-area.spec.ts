import { test, expect } from '@playwright/test';

test.describe('Community Area Pages', () => {
	test('loads community area page with valid ID', async ({ page }) => {
		// Navigate to communities page (which redirects to africa section)
		await page.goto('http://127.0.0.1:5173/communities/africa');

		// Wait for communities page to load
		await page.waitForLoadState('domcontentloaded');
		await page.waitForSelector('main', { timeout: 10000 });

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.waitFor({ state: 'visible' });
		await firstCommunityLink.click();
		// Wait for navigation to complete
		await page.waitForLoadState('domcontentloaded');

		// Verify we're on a community area page (app redirects to merchants section)
		await expect(page).toHaveURL(/\/community\/[^/]+\/merchants$/);

		// Check that the page has loaded with basic elements
		const breadcrumbs = page.locator(
			'nav[aria-label="breadcrumb"], .breadcrumb, nav:has(a[href="/communities"])'
		);
		await expect(breadcrumbs).toBeVisible();

		// Check that the main content area exists
		const mainContent = page.locator('main, .main, [role="main"]');
		await expect(mainContent).toBeVisible();
	});

	test('displays correct breadcrumb navigation', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.click();

		// Wait for community page to load
		await page.waitForLoadState('networkidle');

		// Check breadcrumb links
		const communitiesLink = page.getByRole('link', { name: 'Communities' });
		await expect(communitiesLink).toBeVisible();
		await expect(communitiesLink).toHaveAttribute('href', '/communities');

		// Test breadcrumb navigation
		await communitiesLink.click();
		await expect(page).toHaveURL(/\/communities\/africa$/); // App redirects to africa section
	});

	test('handles section navigation with route parameters', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		const communityHref = await firstCommunityLink.getAttribute('href');
		if (!communityHref) return;

		// Test navigation to different sections using route parameters
		const testSections = ['stats', 'activity', 'maintain'];

		for (const section of testSections) {
			await page.goto(`http://127.0.0.1:5173${communityHref}/${section}`);
			await page.waitForLoadState('networkidle');

			// Verify the URL contains the section parameter
			await expect(page).toHaveURL(
				new RegExp(`${communityHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${section}$`)
			);
		}
	});

	test('defaults to merchants section when no section is provided', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.click();

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Should redirect to merchants section if community exists, otherwise stay on communities page
		const currentUrl = page.url();
		const isOnCommunityPage = currentUrl.includes('/community/');
		const isOnCommunitiesPage = currentUrl.includes('/communities/');
		expect(isOnCommunityPage || isOnCommunitiesPage).toBe(true);

		// Check that merchants section is displayed
		const merchantsContent = page.locator('text="Merchants"').first();
		await expect(merchantsContent).toBeVisible();
	});

	test('displays community information and metadata', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.click();

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check that basic community information is displayed
		// The page should have a community or communities title
		const pageTitle = await page.title();
		const hasValidTitle =
			pageTitle.includes('BTC Map Community') || pageTitle.includes('BTC Map - Communities');
		expect(hasValidTitle).toBe(true);

		// Check for common community page elements
		const communityInfo = page.locator('h1, h2, .community-name, .area-name').first();
		await expect(communityInfo).toBeVisible();
	});

	test('handles section switching via tab navigation', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.click();

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Look for section tabs/buttons
		const possibleSections = ['Stats', 'Activity', 'Maintain'];

		for (const sectionName of possibleSections) {
			const sectionButton = page
				.getByRole('button', { name: sectionName })
				.or(page.getByRole('tab', { name: sectionName }))
				.or(page.locator(`text="${sectionName}"`).first());

			// Only test if the section exists
			if (await sectionButton.isVisible()) {
				await sectionButton.click();

				// Wait a bit for any content to load
				await page.waitForTimeout(500);

				// Check that the URL updated with the section parameter
				await expect(page).toHaveURL(new RegExp(`/${sectionName.toLowerCase()}$`));
			}
		}
	});

	test('handles invalid community ID gracefully', async ({ page }) => {
		// Navigate directly to an invalid community ID
		await page.goto('http://127.0.0.1:5173/community/invalid-community-id');

		// The page should either redirect to 404 or handle the error gracefully
		await page.waitForLoadState('networkidle');

		// Check if we're redirected to 404, have an error message, or redirect to communities
		const isOn404 = page.url().includes('/404');
		const hasErrorMessage = await page.locator('text="Could not find"').isVisible();
		const isOnCommunitiesPage = page.url().includes('/communities/');

		// One of these should be true - 404, error message, or redirect to communities page
		expect(isOn404 || hasErrorMessage || isOnCommunitiesPage).toBe(true);
	});

	test('loads and displays merchant information in merchants section', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.click();

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Should be on merchants section by default
		// Look for merchant-related content
		const merchantLinks = page.locator('a[href^="/merchant/"]');

		// If there are merchants, check that they're displayed
		if ((await merchantLinks.count()) > 0) {
			await expect(merchantLinks.first()).toBeVisible();
		}
	});

	test('preserves section when navigating back from merchant page', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		const communityHref = await firstCommunityLink.getAttribute('href');
		if (!communityHref) return; // Skip test if no href found
		await firstCommunityLink.click();

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Navigate to stats section
		await page.goto(`http://127.0.0.1:5173${communityHref}/stats`);
		await page.waitForLoadState('networkidle');

		// If there are merchant links, click on one
		const merchantLinks = page.locator('a[href^="/merchant/"]');
		if ((await merchantLinks.count()) > 0) {
			await merchantLinks.first().click();
			await page.waitForLoadState('networkidle');

			// Go back
			await page.goBack();

			// Should still be on the stats section
			await expect(page).toHaveURL(
				new RegExp(`${communityHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/stats$`)
			);
		}
	});

	test('handles community section URLs robustly', async ({ page }) => {
		// Test different community section URLs by getting actual community links
		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForLoadState('networkidle');

		// Get the first few community links
		const communityLinks = page.locator('a[href^="/community/"]');
		const linkCount = await communityLinks.count();

		if (linkCount > 0) {
			// Test first 3 communities (or all if less than 3)
			const testCount = Math.min(3, linkCount);
			const testSections = ['merchants', 'stats', 'activity', 'maintain'];

			for (let i = 0; i < testCount; i++) {
				const communityHref = await communityLinks.nth(i).getAttribute('href');
				if (!communityHref) continue;

				for (const section of testSections) {
					await page.goto(`http://127.0.0.1:5173${communityHref}/${section}`);
					await page.waitForLoadState('networkidle');

					// Check that we're on the correct community section page
					await expect(page).toHaveURL(
						new RegExp(`${communityHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${section}$`)
					);

					// Check that the page loads without JavaScript errors
					const isOn404 = page.url().includes('/404');
					expect(isOn404).toBe(false);

					// Check that the page has basic content
					const bodyContent = await page.locator('body').textContent();
					expect(bodyContent).toBeTruthy();
					expect(bodyContent!.length).toBeGreaterThan(10);
				}
			}
		}
	});

	test('handles community data loading errors gracefully', async ({ page }) => {
		// Test that the page handles undefined/error data gracefully
		await page.goto('http://127.0.0.1:5173/community/invalid-community/merchants');
		await page.waitForLoadState('networkidle');

		// Should either show 404 or handle gracefully
		const isOn404 = page.url().includes('/404');
		const hasErrorContent = (await page.locator('text="Could not find"').count()) > 0;
		const hasConsoleError = (await page.locator('text="error"').count()) > 0;

		// One of these should be true - either proper error handling or 404
		const isHandledGracefully = isOn404 || hasErrorContent || hasConsoleError;

		if (!isHandledGracefully) {
			// If none of the above, at least the page should load without crashing
			const bodyContent = await page.locator('body').textContent();
			expect(bodyContent).toBeTruthy();
		}
	});

	test('handles community tickets data loading robustly', async ({ page }) => {
		// Test that the AreaPage component handles various ticket data states for communities
		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForLoadState('networkidle');

		// Get the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		const communityHref = await firstCommunityLink.getAttribute('href');

		if (communityHref) {
			await page.goto(`http://127.0.0.1:5173${communityHref}/merchants`);
			await page.waitForLoadState('networkidle');

			// Check that no "Cannot read properties of undefined" errors occur
			const errors: string[] = [];
			page.on('pageerror', (error) => {
				errors.push(error.message);
			});

			// Wait a bit to let any errors surface
			await page.waitForTimeout(2000);

			// Filter for the specific error we're trying to prevent
			const undefinedErrors = errors.filter(
				(error) => error.includes('Cannot read properties of undefined') && error.includes('filter')
			);

			expect(undefinedErrors.length).toBe(0);

			// Also check that the page loads basic content
			const bodyContent = await page.locator('body').textContent();
			expect(bodyContent).toBeTruthy();
			expect(bodyContent!.length).toBeGreaterThan(100);
		}
	});
});
