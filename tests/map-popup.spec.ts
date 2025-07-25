import { test, expect } from '@playwright/test';

test.describe('Map Popup', () => {
	test('popup title click navigates to merchant detail page', async ({ page }) => {
		// Wait for API responses to complete
		await page.goto('http://127.0.0.1:5173/map', { waitUntil: 'networkidle' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for map to be fully initialized and for markers to appear
		// Give extra time for API data to load and process
		await page.waitForTimeout(10000);

		// Look for any kind of marker - try different selectors
		const markerSelectors = [
			'.leaflet-marker-pane img',
			'.leaflet-marker-pane > div',
			'.leaflet-marker-cluster-small',
			'.leaflet-marker-cluster-medium',
			'.leaflet-marker-cluster-large',
			'.leaflet-cluster-anim'
		];

		let markersFound = false;
		for (const selector of markerSelectors) {
			const count = await page.locator(selector).count();
			if (count > 0) {
				console.log(`Found ${count} markers with selector: ${selector}`);
				markersFound = true;
				break;
			}
		}

		// If no markers found, wait a bit longer and try again
		if (!markersFound) {
			await page.waitForTimeout(15000);
			for (const selector of markerSelectors) {
				const count = await page.locator(selector).count();
				if (count > 0) {
					console.log(`Found ${count} markers with selector: ${selector} (after extra wait)`);
					markersFound = true;
					break;
				}
			}
		}

		const markers = page.locator('.leaflet-marker-pane img, .leaflet-marker-pane > div').first();
		await expect(markers).toBeVisible({ timeout: 5000 });

		// Click on the first marker
		await markers.first().click();

		// Wait for popup to appear and look for merchant link
		const merchantLink = page.locator('a[href*="/merchant/"]').first();
		await expect(merchantLink).toBeVisible({ timeout: 10000 });

		// Click the merchant link
		await merchantLink.click();

		// Should now successfully navigate to merchant detail page
		await expect(page).toHaveURL(/\/merchant\//);

		// Check that we're on the merchant detail page by looking for merchant-specific content
		await expect(page.getByText('Last Surveyed')).toBeVisible();
		await expect(page.getByText('Boost')).toBeVisible();
		await expect(page.getByText('Comments')).toBeVisible();
	});

	test('popup shows Comments button with count', async ({ page }) => {
		// Wait for API responses to complete
		await page.goto('http://127.0.0.1:5173/map', { waitUntil: 'networkidle' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for map to be fully initialized and for markers to appear
		// Give extra time for API data to load and process
		await page.waitForTimeout(10000);

		// Use JavaScript to click a marker directly (bypassing viewport issues)
		const markerClicked = await page.evaluate(() => {
			// Find any individual marker (not cluster)
			const markers = document.querySelectorAll(
				'.leaflet-marker-pane > div:not([class*="cluster"])'
			);
			if (markers.length > 0) {
				// Click the first marker
				(markers[0] as HTMLElement).click();
				return true;
			}

			// If no individual markers, try clusters
			const clusters = document.querySelectorAll('.leaflet-marker-cluster');
			if (clusters.length > 0) {
				// Click cluster to expand
				(clusters[0] as HTMLElement).click();
				// Wait a bit and try individual markers again
				setTimeout(() => {
					const expandedMarkers = document.querySelectorAll(
						'.leaflet-marker-pane > div:not([class*="cluster"])'
					);
					if (expandedMarkers.length > 0) {
						(expandedMarkers[0] as HTMLElement).click();
					}
				}, 1000);
				return true;
			}
			return false;
		});

		if (markerClicked) {
			// Wait for popup to appear after JavaScript click
			await page.waitForTimeout(3000);
		} else {
			throw new Error('No markers found to click');
		}

		// Wait for popup to appear and check Comments button
		const commentsButton = page.locator('a[href*="#comments"]');
		await expect(commentsButton).toBeVisible({ timeout: 10000 });

		// Check that it shows "Comments" text
		await expect(commentsButton).toContainText('Comments');

		// Check that it shows a number (comment count) - could be 0 or higher
		const commentCountDiv = commentsButton.locator('div').first();
		await expect(commentCountDiv).toBeVisible();

		// The count should be a number (0 or positive integer)
		const countText = await commentCountDiv.textContent();
		const trimmedCount = countText?.trim() || '';
		expect(trimmedCount).toMatch(/^\d+$/);
	});
});
