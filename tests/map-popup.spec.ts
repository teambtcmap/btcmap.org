import { test, expect } from '@playwright/test';

test.describe('Map Popup', () => {
	test('popup title click navigates to merchant detail page', async ({ page }) => {
		// Increase timeout for this test since it involves network requests
		test.setTimeout(60000);
		// Wait for API responses to complete
		await page.goto('http://127.0.0.1:5173/map', { waitUntil: 'networkidle' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for map to be fully initialized and for markers to appear
		// Give extra time for API data to load and process
		await page.waitForTimeout(10000);

		// Helper function to find and click a marker with retry logic
		const findAndClickMarker = async () => {
			// First, try to find individual (non-cluster) markers
			const individualMarkers = page.locator('.leaflet-marker-pane > div:not([class*="cluster"])');
			const individualCount = await individualMarkers.count();
			
			if (individualCount > 0) {
				console.log(`Found ${individualCount} individual markers`);
				await individualMarkers.first().click();
				return true;
			}
			
			// If no individual markers, try clusters
			const clusterSelectors = [
				'.leaflet-marker-cluster-small',
				'.leaflet-marker-cluster-medium', 
				'.leaflet-marker-cluster-large'
			];
			
			for (const selector of clusterSelectors) {
				const count = await page.locator(selector).count();
				if (count > 0) {
					console.log(`Found ${count} clusters with selector: ${selector}`);
					const cluster = page.locator(selector).first();
					await cluster.click();
					await page.waitForTimeout(3000); // Wait for cluster expansion
					
					// Check for expanded individual markers
					const expandedCount = await individualMarkers.count();
					if (expandedCount > 0) {
						console.log(`Found ${expandedCount} expanded individual markers`);
						await individualMarkers.first().click();
						return true;
					}
				}
			}
			
			throw new Error('No clickable markers found');
		};

		// Find and click a marker
		await findAndClickMarker();

		// Wait for the API request to complete after clicking marker with retry
		// Sometimes the API call might be cached or already completed, so we'll check for popup appearance instead
		let apiResponseReceived = false;
		try {
			// Try to wait for API response, but don't fail if it doesn't come
			await page.waitForResponse(response => 
				response.url().includes('api.btcmap.org/v4/places/') && response.status() === 200,
				{ timeout: 8000 }
			);
			apiResponseReceived = true;
			console.log('API response received');
		} catch (error) {
			console.log('API response wait failed, but continuing - popup might already be loading:', error.message);
			// Continue anyway, the popup might already be loading from cache or previous request
		}

		// Wait for popup to appear - look for the popup content wrapper first
		await expect(page.locator('.leaflet-popup-content-wrapper')).toBeVisible({ timeout: 15000 });

		// Wait a bit more for the popup content to be fully rendered
		await page.waitForTimeout(2000);

		// Look for merchant link with updated selector - try multiple approaches
		let merchantLink;
		const merchantLinkSelectors = [
			'.leaflet-popup-content a[href*="/merchant/"]', // Primary selector
			'.leaflet-popup-content-wrapper a[href*="/merchant/"]', // Alternative wrapper
			'a[href*="/merchant/"]:visible' // Any visible merchant link
		];

		for (const selector of merchantLinkSelectors) {
			const linkCount = await page.locator(selector).count();
			if (linkCount > 0) {
				console.log(`Found merchant link with selector: ${selector}`);
				merchantLink = page.locator(selector).first();
				break;
			}
		}

		if (!merchantLink) {
			// Debug: log popup content if merchant link not found
			const popupContent = await page.locator('.leaflet-popup-content').innerHTML().catch(() => 'Could not get popup content');
			console.log('Popup content:', popupContent);
			throw new Error('Merchant link not found in popup');
		}

		await expect(merchantLink).toBeVisible({ timeout: 10000 });

		// Get the href for verification
		const merchantHref = await merchantLink.getAttribute('href');
		console.log('Found merchant link:', merchantHref);

		// Click the merchant link
		await merchantLink.click();

		// Should now successfully navigate to merchant detail page
		await expect(page).toHaveURL(/\/merchant\//);

		// Check that we're on the merchant detail page by looking for merchant-specific content
		await expect(page.getByText('Last Surveyed')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Boost' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Comments', exact: true })).toBeVisible();
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
