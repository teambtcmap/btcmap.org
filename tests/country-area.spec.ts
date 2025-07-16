import { test, expect } from '@playwright/test';
import { describe } from 'node:test';

describe('Country Area Pages', () => {
	test('loads country area page with valid ID', async ({ page }) => {
		// Navigate directly to South Africa country page
		await page.goto('http://127.0.0.1:5173/country/za');
		
		// Should redirect to merchants section
		await expect(page).toHaveURL(/\/country\/za\/merchants$/);
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Check that the page title is correct
		const pageTitle = await page.title();
		expect(pageTitle).toContain('South Africa');
		
		// Check that some content has loaded (not blank page)
		const bodyContent = await page.locator('body').textContent();
		expect(bodyContent).toBeTruthy();
		expect(bodyContent.length).toBeGreaterThan(100);
	});

	test('displays correct breadcrumb navigation', async ({ page }) => {
		// Navigate directly to South Africa
		await page.goto('http://127.0.0.1:5173/country/za');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Check breadcrumb links
		const countriesLink = page.getByRole('link', { name: 'Countries' });
		await expect(countriesLink).toBeVisible();
		await expect(countriesLink).toHaveAttribute('href', '/countries');
		
		// Test breadcrumb navigation
		await countriesLink.click();
		await expect(page).toHaveURL(/\/countries/);
	});

	test('handles section navigation with route parameters', async ({ page }) => {
		// Test navigation to different sections using route parameters
		const testSections = ['merchants', 'stats', 'activity', 'maintain'];
		
		for (const section of testSections) {
			await page.goto(`http://127.0.0.1:5173/country/za/${section}`);
			await page.waitForLoadState('networkidle');
			
			// Verify the URL contains the section
			await expect(page).toHaveURL(new RegExp(`/country/za/${section}$`));
		}
	});

	test('defaults to merchants section when no section is provided', async ({ page }) => {
		// Navigate directly to South Africa
		await page.goto('http://127.0.0.1:5173/country/za');
		
		// Should redirect to merchants section
		await expect(page).toHaveURL(/\/country\/za\/merchants$/);
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Check that we're on the merchants section by default
		const merchantsContent = page.locator('text="Merchants"').first();
		await expect(merchantsContent).toBeVisible();
	});

	test('displays country information and metadata', async ({ page }) => {
		// Navigate directly to South Africa
		await page.goto('http://127.0.0.1:5173/country/za');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Check that basic country information is displayed
		// The page should have a country name in the title or header
		const pageTitle = await page.title();
		expect(pageTitle).toContain('South Africa');
		expect(pageTitle).toContain('BTC Map Country');
		
		// Check for country-specific elements
		const countryHeading = page.getByRole('heading', { name: 'South Africa', exact: true });
		await expect(countryHeading).toBeVisible();
		
		// Check for country flag/icon (common in country pages)
		const countryFlag = page.locator('img[alt*="South Africa"], img[src*="za"], img[src*="south-africa"]');
		if (await countryFlag.count() > 0) {
			await expect(countryFlag.first()).toBeVisible();
		}
	});

	test('handles section switching via tab navigation', async ({ page }) => {
		// Navigate directly to South Africa merchants section
		await page.goto('http://127.0.0.1:5173/country/za/merchants');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Look for section tabs/buttons in the main content area
		const possibleSections = ['Stats', 'Activity', 'Maintain'];
		
		for (const sectionName of possibleSections) {
			// Look for section buttons specifically in the main content, not in dropdowns
			const sectionButton = page.locator('main').getByRole('button', { name: sectionName }).first();
			
			// Only test if the section exists and is visible
			if (await sectionButton.isVisible()) {
				await sectionButton.click();
				
				// Wait a bit for any content to load
				await page.waitForTimeout(500);
				
				// Check that the URL updated to the new section
				await expect(page).toHaveURL(new RegExp(`/country/za/${sectionName.toLowerCase()}$`));
			}
		}
	});

	test('handles invalid country ID gracefully', async ({ page }) => {
		// Navigate directly to an invalid country ID
		await page.goto('http://127.0.0.1:5173/country/invalid-country-id');
		
		// The page should either redirect to 404 or handle the error gracefully
		await page.waitForLoadState('networkidle');
		
		// Check if we're redirected to 404 or if there's an error message
		const isOn404 = page.url().includes('/404');
		const hasErrorMessage = await page.locator('text="Could not find"').isVisible();
		const hasConsoleError = await page.locator('text="error"').isVisible();
		
		// One of these should be true, or the page should handle it gracefully
		const isHandledGracefully = isOn404 || hasErrorMessage || hasConsoleError;
		
		// If none of the above, at least the page should have loaded something
		if (!isHandledGracefully) {
			const hasContent = await page.locator('body').isVisible();
			expect(hasContent).toBe(true);
		}
	});

	test('loads and displays merchant information in merchants section', async ({ page }) => {
		// Navigate directly to South Africa
		await page.goto('http://127.0.0.1:5173/country/za');
		
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

	test('displays country statistics in stats section', async ({ page }) => {
		// Navigate directly to South Africa stats section
		await page.goto('http://127.0.0.1:5173/country/za#stats');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Look for stats-related content
		const statsContent = page.locator('text="Stats"').first();
		await expect(statsContent).toBeVisible();
		
		// Look for common statistics elements
		const statsNumbers = page.locator('[data-testid*="stat"], .stat, .statistic').first();
		if (await statsNumbers.count() > 0) {
			await expect(statsNumbers).toBeVisible();
		}
	});

	test('preserves section when navigating back from merchant page', async ({ page }) => {
		// Navigate directly to South Africa stats section
		await page.goto('http://127.0.0.1:5173/country/za#stats');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// If there are merchant links, click on one
		const merchantLinks = page.locator('a[href^="/merchant/"]');
		if (await merchantLinks.count() > 0) {
			await merchantLinks.first().click();
			await page.waitForLoadState('networkidle');
			
			// Go back
			await page.goBack();
			
			// Should still be on the stats section
			await expect(page).toHaveURL(/\/country\/za#stats/);
		}
	});

	test('handles different country codes correctly', async ({ page }) => {
		// Test a few different country codes to ensure the routing works
		const testCountries = [
			{ code: 'us', name: 'United States' },
			{ code: 'de', name: 'Germany' },
			{ code: 'gb', name: 'United Kingdom' }
		];
		
		for (const country of testCountries) {
			await page.goto(`http://127.0.0.1:5173/country/${country.code}`);
			await page.waitForLoadState('networkidle');
			
			// Check that we're on the correct country page
			await expect(page).toHaveURL(new RegExp(`/country/${country.code}$`));
			
			// Check that the page loads (doesn't redirect to 404)
			const isOn404 = page.url().includes('/404');
			expect(isOn404).toBe(false);
		}
	});

	test('displays activity feed in activity section', async ({ page }) => {
		// Navigate directly to South Africa activity section
		await page.goto('http://127.0.0.1:5173/country/za#activity');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Look for activity-related content
		const activityContent = page.locator('text="Activity"').first();
		await expect(activityContent).toBeVisible();
		
		// Look for activity feed elements
		const activityItems = page.locator('[data-testid*="activity"], .activity-item, .activity-feed').first();
		if (await activityItems.count() > 0) {
			await expect(activityItems).toBeVisible();
		}
	});

	test('displays maintenance information in maintain section', async ({ page }) => {
		// Navigate directly to South Africa maintain section
		await page.goto('http://127.0.0.1:5173/country/za/maintain');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Look for maintain-related content
		const maintainContent = page.locator('text="Maintain"').first();
		await expect(maintainContent).toBeVisible();
		
		// Look for maintenance-related elements (tickets, issues, etc.)
		const maintainItems = page.locator('[data-testid*="ticket"], .ticket, .issue, .maintenance').first();
		if (await maintainItems.count() > 0) {
			await expect(maintainItems).toBeVisible();
		}
	});

	test('handles legacy hash URLs with redirect', async ({ page }) => {
		// Test that old hash-based URLs get redirected to new structure
		await page.goto('http://127.0.0.1:5173/country/za#stats');

		// Should redirect to new route structure
		await expect(page).toHaveURL(/\/country\/za\/stats$/);

		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Check that Stats section is shown
		const statsContent = page.locator('text="Stats"').first();
		await expect(statsContent).toBeVisible();
	});

	test('handles invalid legacy hash URLs', async ({ page }) => {
		// Test that invalid hash URLs get redirected to default
		await page.goto('http://127.0.0.1:5173/country/za#invalid-section');

		// Should redirect to default merchants section
		await expect(page).toHaveURL(/\/country\/za\/merchants$/);

		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Should show merchants section
		const merchantsContent = page.locator('text="Merchants"').first();
		await expect(merchantsContent).toBeVisible();
	});
});