import { test, expect } from '@playwright/test';
import { describe } from 'node:test';

describe('Community Area Pages', () => {
	test('loads community area page with valid ID', async ({ page }) => {
		// Navigate to communities page first
		await page.goto('http://127.0.0.1:5173/communities');
		
		// Wait for communities page to load
		const communitiesHeading = page.getByRole('heading', {
			name: 'Join the bitcoin map community.'
		});
		await communitiesHeading.waitFor({ state: 'visible' });
		
		// Click on the first community link
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.click();
		
		// Verify we're on a community area page
		await expect(page).toHaveURL(/\/community\/[^/]+$/);
		
		// Check that the page has loaded with basic elements
		const breadcrumbs = page.locator('nav[aria-label="breadcrumb"], .breadcrumb, nav:has(a[href="/communities"])');
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
		await expect(page).toHaveURL(/\/communities$/);
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
			await expect(page).toHaveURL(new RegExp(`${communityHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${section}$`));
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
		
		// Should redirect to merchants section
		const currentUrl = page.url();
		expect(currentUrl).toContain('/community/');
		expect(currentUrl).toContain('/merchants');
		
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
		// The page should have a community name in the title or header
		const pageTitle = await page.title();
		expect(pageTitle).toContain('BTC Map Community');
		
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
			const sectionButton = page.getByRole('button', { name: sectionName }).or(
				page.getByRole('tab', { name: sectionName })
			).or(
				page.locator(`text="${sectionName}"`).first()
			);
			
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
		
		// Check if we're redirected to 404 or if there's an error message
		const isOn404 = page.url().includes('/404');
		const hasErrorMessage = await page.locator('text="Could not find"').isVisible();
		
		// One of these should be true
		expect(isOn404 || hasErrorMessage).toBe(true);
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
		if (await merchantLinks.count() > 0) {
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
		await firstCommunityLink.click();
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Navigate to stats section
		await page.goto(`http://127.0.0.1:5173${communityHref}/stats`);
		await page.waitForLoadState('networkidle');
		
		// If there are merchant links, click on one
		const merchantLinks = page.locator('a[href^="/merchant/"]');
		if (await merchantLinks.count() > 0) {
			await merchantLinks.first().click();
			await page.waitForLoadState('networkidle');
			
			// Go back
			await page.goBack();
			
			// Should still be on the stats section
			await expect(page).toHaveURL(new RegExp(`${communityHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/stats$`));
		}
	});
});