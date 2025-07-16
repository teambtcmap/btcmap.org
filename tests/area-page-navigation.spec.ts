import { test, expect } from '@playwright/test';
import { describe } from 'node:test';

describe('AreaPage Hash Navigation', () => {
	// Test both community and country pages for consistent navigation behavior
	const testCases = [
		{ type: 'community', url: 'http://127.0.0.1:5173/communities', linkSelector: 'a[href^="/community/"]' },
		{ type: 'country', url: 'http://127.0.0.1:5173/country/za', linkSelector: null }
	];

	testCases.forEach(({ type, url, linkSelector }) => {
		describe(`${type} page navigation`, () => {
			test(`${type} page defaults to merchants section`, async ({ page }) => {
				if (linkSelector) {
					// Navigate to listing page first
					await page.goto(url);
					await page.waitForLoadState('networkidle');
					
					// Click on first item
					const firstLink = page.locator(linkSelector).first();
					await firstLink.click();
				} else {
					// Navigate directly to the area page
					await page.goto(url);
				}
				
				await page.waitForLoadState('networkidle');
				
				// Should default to merchants section (no hash)
				const currentUrl = page.url();
				const hasHash = currentUrl.includes('#');
				
				// If there's no hash, we're on the default section
				if (!hasHash) {
					const merchantsText = page.locator('text="Merchants"').first();
					await expect(merchantsText).toBeVisible();
				}
			});

			test(`${type} page hash navigation to all sections`, async ({ page }) => {
				let baseUrl: string;
				
				if (linkSelector) {
					// Navigate to listing page first
					await page.goto(url);
					await page.waitForLoadState('networkidle');
					
					// Click on first item and get the URL
					const firstLink = page.locator(linkSelector).first();
					const href = await firstLink.getAttribute('href');
					baseUrl = `http://127.0.0.1:5173${href}`;
					await firstLink.click();
				} else {
					baseUrl = url;
					await page.goto(baseUrl);
				}
				
				await page.waitForLoadState('networkidle');
				
				// Test navigation to each section
				const sections = ['merchants', 'stats', 'activity', 'maintain'];
				
				for (const section of sections) {
					await page.goto(`${baseUrl}#${section}`);
					await page.waitForLoadState('networkidle');
					
					// Verify the URL contains the hash
					await expect(page).toHaveURL(new RegExp(`#${section}$`));
					
					// Verify the section content is visible
					const sectionText = page.locator(`text="${section.charAt(0).toUpperCase() + section.slice(1)}"`).first();
					await expect(sectionText).toBeVisible();
				}
			});

			test(`${type} page section switching via UI elements`, async ({ page }) => {
				let baseUrl: string;
				
				if (linkSelector) {
					// Navigate to listing page first
					await page.goto(url);
					await page.waitForLoadState('networkidle');
					
					// Click on first item
					const firstLink = page.locator(linkSelector).first();
					const href = await firstLink.getAttribute('href');
					baseUrl = `http://127.0.0.1:5173${href}`;
					await firstLink.click();
				} else {
					baseUrl = url;
					await page.goto(baseUrl);
				}
				
				await page.waitForLoadState('networkidle');
				
				// Look for section navigation buttons/tabs
				const sectionNames = ['Stats', 'Activity', 'Maintain'];
				
				for (const sectionName of sectionNames) {
					// Try different selectors for section buttons
					const sectionButton = page.getByRole('button', { name: sectionName }).or(
						page.getByRole('tab', { name: sectionName })
					).or(
						page.locator(`[data-section="${sectionName.toLowerCase()}"]`)
					).or(
						page.locator(`text="${sectionName}"`).first()
					);
					
					if (await sectionButton.isVisible()) {
						await sectionButton.click();
						await page.waitForTimeout(500);
						
						// Check that the URL updated with the hash
						await expect(page).toHaveURL(new RegExp(`#${sectionName.toLowerCase()}`));
					}
				}
			});

			test(`${type} page hash change handling`, async ({ page }) => {
				let baseUrl: string;
				
				if (linkSelector) {
					// Navigate to listing page first
					await page.goto(url);
					await page.waitForLoadState('networkidle');
					
					// Click on first item
					const firstLink = page.locator(linkSelector).first();
					const href = await firstLink.getAttribute('href');
					baseUrl = `http://127.0.0.1:5173${href}`;
					await firstLink.click();
				} else {
					baseUrl = url;
					await page.goto(baseUrl);
				}
				
				await page.waitForLoadState('networkidle');
				
				// Test programmatic hash changes
				await page.evaluate(() => {
					window.location.hash = '#stats';
				});
				
				await page.waitForTimeout(500);
				await expect(page).toHaveURL(/#{stats}$/);
				
				// Test another hash change
				await page.evaluate(() => {
					window.location.hash = '#activity';
				});
				
				await page.waitForTimeout(500);
				await expect(page).toHaveURL(/#{activity}$/);
			});

			test(`${type} page invalid hash handling`, async ({ page }) => {
				let baseUrl: string;
				
				if (linkSelector) {
					// Navigate to listing page first
					await page.goto(url);
					await page.waitForLoadState('networkidle');
					
					// Click on first item
					const firstLink = page.locator(linkSelector).first();
					const href = await firstLink.getAttribute('href');
					baseUrl = `http://127.0.0.1:5173${href}`;
				} else {
					baseUrl = url;
				}
				
				// Navigate with invalid hash
				await page.goto(`${baseUrl}#invalid-section`);
				await page.waitForLoadState('networkidle');
				
				// Should fall back to a valid section or ignore invalid hash
				// The page should still function normally
				const merchantsText = page.locator('text="Merchants"').first();
				await expect(merchantsText).toBeVisible();
			});

			test(`${type} page preserves hash on page refresh`, async ({ page }) => {
				let baseUrl: string;
				
				if (linkSelector) {
					// Navigate to listing page first
					await page.goto(url);
					await page.waitForLoadState('networkidle');
					
					// Click on first item
					const firstLink = page.locator(linkSelector).first();
					const href = await firstLink.getAttribute('href');
					baseUrl = `http://127.0.0.1:5173${href}`;
					await firstLink.click();
				} else {
					baseUrl = url;
					await page.goto(baseUrl);
				}
				
				await page.waitForLoadState('networkidle');
				
				// Navigate to stats section
				await page.goto(`${baseUrl}#stats`);
				await page.waitForLoadState('networkidle');
				
				// Refresh the page
				await page.reload();
				await page.waitForLoadState('networkidle');
				
				// Should still be on stats section
				await expect(page).toHaveURL(/#{stats}$/);
				
				// Stats content should be visible
				const statsText = page.locator('text="Stats"').first();
				await expect(statsText).toBeVisible();
			});

			test(`${type} page browser back/forward with hash navigation`, async ({ page }) => {
				let baseUrl: string;
				
				if (linkSelector) {
					// Navigate to listing page first
					await page.goto(url);
					await page.waitForLoadState('networkidle');
					
					// Click on first item
					const firstLink = page.locator(linkSelector).first();
					const href = await firstLink.getAttribute('href');
					baseUrl = `http://127.0.0.1:5173${href}`;
					await firstLink.click();
				} else {
					baseUrl = url;
					await page.goto(baseUrl);
				}
				
				await page.waitForLoadState('networkidle');
				
				// Navigate through sections
				await page.goto(`${baseUrl}#stats`);
				await page.waitForLoadState('networkidle');
				
				await page.goto(`${baseUrl}#activity`);
				await page.waitForLoadState('networkidle');
				
				// Go back
				await page.goBack();
				await expect(page).toHaveURL(/#{stats}$/);
				
				// Go back again
				await page.goBack();
				await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
				
				// Go forward
				await page.goForward();
				await expect(page).toHaveURL(/#{stats}$/);
			});
		});
	});
});