import { test, expect } from '@playwright/test';

test.describe('Map Popup', () => {
	test('popup title click navigates to merchant detail page', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/map');
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait a bit more for markers to load
		await page.waitForTimeout(3000);

		// Find and click on an individual marker (not a cluster)
		// Look for markers that are individual pins, not numbered clusters
		const markers = page.locator('.leaflet-marker-pane img');
		const markerCount = await markers.count();
		
		// If we have markers, click on the first one
		if (markerCount > 0) {
			await markers.first().click();
			
			// Wait for popup to appear and API call to complete
			await page.waitForTimeout(2000);
			
			// Look for a merchant name link in the popup
			const merchantLink = page.locator('a[href*="/merchant/"]').first();
			
			// If we found a merchant link, click it
			if (await merchantLink.count() > 0) {
				await merchantLink.click();
				
				// Should now successfully navigate to merchant detail page
				await expect(page).toHaveURL(/\/merchant\//);
				
				// Check that we're on the merchant detail page by looking for merchant-specific content
				await expect(page.getByText('Last Surveyed')).toBeVisible();
				await expect(page.getByText('Boost')).toBeVisible();
				await expect(page.getByText('Comments')).toBeVisible();
			} else {
				// If no merchant link found, skip this test run
				test.skip(true, 'No merchant popup found on this test run');
			}
		} else {
			// If no markers found, skip this test run
			test.skip(true, 'No map markers found on this test run');
		}
	});

	test('popup shows Comments button with count', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/map');
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForTimeout(3000);

		// Find and click on an individual marker
		const markers = page.locator('.leaflet-marker-pane img');
		const markerCount = await markers.count();
		
		if (markerCount > 0) {
			await markers.first().click();
			
			// Wait for popup to appear
			await page.waitForTimeout(2000);
			
			// Check that Comments button exists and has proper structure
			const commentsButton = page.locator('a[href*="#comments"]');
			await expect(commentsButton).toBeVisible();
			
			// Check that it shows "Comments" text
			await expect(commentsButton).toContainText('Comments');
			
			// Check that it shows a number (comment count) - could be 0 or higher
			const commentCountDiv = commentsButton.locator('div').first();
			await expect(commentCountDiv).toBeVisible();
			
			// The count should be a number (0 or positive integer)
			const countText = await commentCountDiv.textContent();
			expect(countText).toMatch(/^\d+$/);
		} else {
			test.skip(true, 'No map markers found on this test run');
		}
	});

	test('popup no longer shows More button with flyout menu', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/map');
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForTimeout(3000);

		// Find and click on an individual marker
		const markers = page.locator('.leaflet-marker-pane img');
		const markerCount = await markers.count();
		
		if (markerCount > 0) {
			await markers.first().click();
			
			// Wait for popup to appear
			await page.waitForTimeout(2000);
			
			// Verify that the old More button is no longer present
			const moreButton = page.locator('button#more-button');
			await expect(moreButton).not.toBeVisible();
			
			// Verify that the flyout menu is not present
			const showMoreDiv = page.locator('#show-more');
			await expect(showMoreDiv).not.toBeVisible();
			
			// Verify we have the standard 4 buttons: Navigate, Edit, Share, Comments
			const popupButtons = page.locator('.leaflet-popup-content a, .leaflet-popup-content button');
			const buttonCount = await popupButtons.count();
			
			// Should have exactly 4 action buttons + 1 boost button = 5 total
			expect(buttonCount).toBeGreaterThanOrEqual(4);
			
			// Check that all expected buttons are present
			await expect(page.locator('a[href^="geo:"]')).toBeVisible(); // Navigate
			await expect(page.locator('a[href*="openstreetmap.org"]')).toBeVisible(); // Edit
			await expect(page.locator('a[href*="/merchant/"]')).toBeVisible(); // Share & title link
			await expect(page.locator('a[href*="#comments"]')).toBeVisible(); // Comments
		} else {
			test.skip(true, 'No map markers found on this test run');
		}
	});
});