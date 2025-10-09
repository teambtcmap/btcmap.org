import { test, expect } from '@playwright/test';

test.describe('Map Popup', () => {
	test('popup title click navigates to merchant detail page', async ({ page }) => {
		// Increase timeout for this test since it involves network requests
		test.setTimeout(180000); // 3 minutes to handle slow data loading
		// Wait for page to load (use 'load' instead of 'networkidle' for better reliability)
		await page.goto('http://127.0.0.1:5173/map', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for map to be fully initialized and for markers to appear
		// Give extra time for API data to load and process
		await page.waitForTimeout(10000);

		// Helper function to find and click a marker with viewport-aware logic
		const findAndClickMarker = async () => {
			// Use JavaScript to find and click markers, bypassing viewport restrictions
			const markerClicked = await page.evaluate(() => {
				// Helper function to check if element is in viewport
				const isInViewport = (element: Element) => {
					const rect = element.getBoundingClientRect();
					const viewport = {
						width: window.innerWidth,
						height: window.innerHeight
					};
					return (
						rect.left >= 0 &&
						rect.right <= viewport.width &&
						rect.top >= 0 &&
						rect.bottom <= viewport.height
					);
				};

				// First, try to find individual (non-cluster) markers
				const individualMarkers = document.querySelectorAll(
					'.leaflet-marker-pane > div:not([class*="cluster"])'
				);

				if (individualMarkers.length > 0) {
					// Try to find a marker in viewport first
					const viewportMarker = Array.from(individualMarkers).find(isInViewport);
					if (viewportMarker) {
						(viewportMarker as HTMLElement).click();
						return true;
					}

					// If no viewport markers, click the first one (JavaScript bypasses viewport restrictions)
					(individualMarkers[0] as HTMLElement).click();
					return true;
				}

				// If no individual markers, try clusters
				const clusterSelectors = [
					'.leaflet-marker-cluster-small',
					'.leaflet-marker-cluster-medium',
					'.leaflet-marker-cluster-large'
				];

				for (const selector of clusterSelectors) {
					const clusters = document.querySelectorAll(selector);
					if (clusters.length > 0) {
						// Find viewport cluster or use first one
						const viewportCluster = Array.from(clusters).find(isInViewport);
						const clusterToClick = viewportCluster || clusters[0];
						(clusterToClick as HTMLElement).click();

						// Wait a bit for cluster expansion
						setTimeout(() => {
							const expandedMarkers = document.querySelectorAll(
								'.leaflet-marker-pane > div:not([class*="cluster"])'
							);
							if (expandedMarkers.length > 0) {
								const expandedViewportMarker = Array.from(expandedMarkers).find(isInViewport);
								const markerToClick = expandedViewportMarker || expandedMarkers[0];
								(markerToClick as HTMLElement).click();
							}
						}, 1000);
						return true;
					}
				}

				return false;
			});

			if (!markerClicked) {
				// Enhanced debugging: log what markers were found
				const debugInfo = await page.evaluate(() => {
					const individualMarkers = document.querySelectorAll(
						'.leaflet-marker-pane > div:not([class*="cluster"])'
					);
					const clusters = document.querySelectorAll('.leaflet-marker-cluster');
					return {
						individualMarkersCount: individualMarkers.length,
						clustersCount: clusters.length,
						totalMarkers: document.querySelectorAll('.leaflet-marker-pane > div').length
					};
				});
				throw new Error(`No clickable markers found. Debug info: ${JSON.stringify(debugInfo)}`);
			}

			// Wait for the click to be processed
			await page.waitForTimeout(2000);
			return true;
		};

		// Find and click a marker
		await findAndClickMarker();

		// Wait for the API request to complete after clicking marker with retry
		// Sometimes the API call might be cached or already completed, so we'll check for popup appearance instead
		try {
			// Try to wait for API response, but don't fail if it doesn't come
			await page.waitForResponse(
				(response) =>
					response.url().includes('api.btcmap.org/v4/places/') && response.status() === 200,
				{ timeout: 8000 }
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(
				'API response wait failed, but continuing - popup might already be loading:',
				errorMessage
			);
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
				merchantLink = page.locator(selector).first();
				break;
			}
		}

		if (!merchantLink) {
			// Debug: log popup content if merchant link not found
			const popupContent = await page
				.locator('.leaflet-popup-content')
				.innerHTML()
				.catch(() => 'Could not get popup content');
			console.error('Popup content:', popupContent);
			throw new Error('Merchant link not found in popup');
		}

		await expect(merchantLink).toBeVisible({ timeout: 10000 });

		// Get the href for verification
		const merchantHref = await merchantLink.getAttribute('href');
		console.error('Found merchant link:', merchantHref);

		// Click the merchant link
		await merchantLink.click();

		// Should now successfully navigate to merchant detail page
		await expect(page).toHaveURL(/\/merchant\//);

		// Check that we're on the merchant detail page by looking for merchant-specific content
		// Use longer timeout in CI where data sync takes significantly longer
		const timeout = process.env.CI ? 120000 : 60000; // 2 minutes for CI, 1 minute for local
		await expect(page.getByText('Last Surveyed')).toBeVisible({ timeout });
		await expect(page.getByRole('heading', { name: 'Boost' })).toBeVisible();
		await expect(page.getByText('Comments').first()).toBeVisible();
	});

	test('popup shows Comments button with count', async ({ page }) => {
		// Navigate to a specific location with known merchants (San Salvador, El Salvador)
		await page.goto('http://127.0.0.1:5173/map#15/13.6929/-89.2182', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for map to be fully initialized and for viewport-based markers to load
		// Give extra time for API data to load and viewport markers to render
		await page.waitForTimeout(8000);

		// Use JavaScript to click a marker directly
		const markerClicked = await page.evaluate(() => {
			// Find any individual marker (not cluster) - should be visible at zoom 15
			const markers = document.querySelectorAll(
				'.leaflet-marker-pane > div:not([class*="cluster"])'
			);
			if (markers.length > 0) {
				// Click the first marker
				(markers[0] as HTMLElement).click();
				return true;
			}

			// If no individual markers, try to expand clusters first
			const clusters = document.querySelectorAll('.leaflet-marker-cluster');
			if (clusters.length > 0) {
				// Click cluster to expand
				(clusters[0] as HTMLElement).click();
				return 'cluster';
			}
			return false;
		});

		// If we clicked a cluster, wait for it to expand and then click a marker
		if (markerClicked === 'cluster') {
			await page.waitForTimeout(1000);
			const expandedMarkerClicked = await page.evaluate(() => {
				const expandedMarkers = document.querySelectorAll(
					'.leaflet-marker-pane > div:not([class*="cluster"])'
				);
				if (expandedMarkers.length > 0) {
					(expandedMarkers[0] as HTMLElement).click();
					return true;
				}
				return false;
			});

			if (!expandedMarkerClicked) {
				throw new Error('No individual markers found after expanding cluster');
			}
		} else if (!markerClicked) {
			throw new Error('No markers found to click');
		}

		// Wait for popup to appear after marker click
		await page.waitForTimeout(2000);

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
