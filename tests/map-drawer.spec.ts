import { test, expect } from '@playwright/test';

test.describe('Map Drawer', () => {
	// Collect console errors during tests - map JS errors should fail the test
	test.beforeEach(async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});
		// Store errors on page object for access in afterEach
		(page as unknown as { _consoleErrors: string[] })._consoleErrors = errors;
	});

	test.afterEach(async ({ page }) => {
		const errors = (page as unknown as { _consoleErrors: string[] })._consoleErrors || [];
		// Filter out non-critical errors (resource loading failures, minified JS noise)
		const criticalErrors = errors.filter((error) => {
			// Skip single-character errors (minified JS noise)
			if (error.length <= 2) return false;
			if (error.includes('Failed to load resource')) return false;
			if (error.includes('net::ERR_')) return false;
			return true;
		});
		if (criticalErrors.length > 0) {
			throw new Error(`Console errors detected:\n${criticalErrors.join('\n')}`);
		}
	});

	// Helper: wait for places API response, then for markers to render
	async function waitForMarkersToLoad(page: import('@playwright/test').Page) {
		// First wait for the places API to respond
		try {
			await page.waitForResponse(
				(response) => response.url().includes('api.btcmap.org/v4/places') && response.ok(),
				{ timeout: 30000 }
			);
		} catch {
			// API may have already responded before we started waiting
			// Continue and check if markers exist
		}

		// Then wait for markers to render in DOM
		await page.waitForFunction(
			() => document.querySelectorAll('.leaflet-marker-pane > div').length > 0,
			{ timeout: 45000 }
		);
	}

	test('drawer opens on marker click and navigates to merchant detail page', async ({ page }) => {
		test.setTimeout(180000);
		await page.goto('/map#16/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for API response and markers to render
		await waitForMarkersToLoad(page);

		const findAndClickMarker = async () => {
			const markerClicked = await page.evaluate(() => {
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

				const individualMarkers = document.querySelectorAll(
					'.leaflet-marker-pane > div:not([class*="cluster"])'
				);

				if (individualMarkers.length > 0) {
					const viewportMarker = Array.from(individualMarkers).find(isInViewport);
					if (viewportMarker) {
						(viewportMarker as HTMLElement).click();
						return true;
					}

					(individualMarkers[0] as HTMLElement).click();
					return true;
				}

				const clusterSelectors = [
					'.leaflet-marker-cluster-small',
					'.leaflet-marker-cluster-medium',
					'.leaflet-marker-cluster-large'
				];

				for (const selector of clusterSelectors) {
					const clusters = document.querySelectorAll(selector);
					if (clusters.length > 0) {
						const viewportCluster = Array.from(clusters).find(isInViewport);
						const clusterToClick = viewportCluster || clusters[0];
						(clusterToClick as HTMLElement).click();

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

			await page.waitForTimeout(2000);
			return true;
		};

		await findAndClickMarker();

		try {
			await page.waitForResponse(
				(response) =>
					response.url().includes('api.btcmap.org/v4/places/') && response.status() === 200,
				{ timeout: 8000 }
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('API response wait failed, but continuing:', errorMessage);
		}

		// Wait for drawer to open
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });

		await page.waitForTimeout(2000);

		// Look for "View Full Details" button in drawer
		const viewDetailsButton = page.locator('a:has-text("View Full Details")');
		await expect(viewDetailsButton).toBeVisible({ timeout: 10000 });

		const merchantHref = await viewDetailsButton.getAttribute('href');
		console.info('Found merchant link:', merchantHref);

		await viewDetailsButton.click();

		await expect(page).toHaveURL(/\/merchant\//);

		const timeout = process.env.CI ? 30000 : 10000;
		await expect(page.getByText('Last Surveyed')).toBeVisible({ timeout });
		await expect(page.getByRole('heading', { name: 'Boost' })).toBeVisible();
		await expect(page.getByText('Comments').first()).toBeVisible();
	});

	test('drawer shows Comments button with count', async ({ page }) => {
		await page.goto('/map#15/13.6929/-89.2182', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for API response and markers to render
		await waitForMarkersToLoad(page);

		const markerClicked = await page.evaluate(() => {
			const markers = document.querySelectorAll(
				'.leaflet-marker-pane > div:not([class*="cluster"])'
			);
			if (markers.length > 0) {
				(markers[0] as HTMLElement).click();
				return true;
			}

			const clusters = document.querySelectorAll('.leaflet-marker-cluster');
			if (clusters.length > 0) {
				(clusters[0] as HTMLElement).click();
				return 'cluster';
			}
			return false;
		});

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

		await page.waitForTimeout(2000);

		// Check drawer comments button
		const commentsButton = page.locator('a[href*="#comments"]');
		await expect(commentsButton).toBeVisible({ timeout: 10000 });

		await expect(commentsButton).toContainText('Comments');

		const commentCountDiv = commentsButton.locator('div').first();
		await expect(commentCountDiv).toBeVisible();

		const countText = await commentCountDiv.textContent();
		const trimmedCount = countText?.trim() || '';
		expect(trimmedCount).toMatch(/^\d+$/);
	});

	test('drawer opens from URL hash on initial page load (desktop)', async ({ page }) => {
		// Navigate directly to map with merchant hash parameter
		await page.goto('/map#15/53.55573/10.00825&merchant=6556', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for drawer to open automatically
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });

		// Wait for merchant data to load
		try {
			await page.waitForResponse(
				(response) =>
					response.url().includes('api.btcmap.org/v4/places/6556') && response.status() === 200,
				{ timeout: 10000 }
			);
		} catch (error) {
			console.error('API response wait failed:', error);
		}

		// Verify "View Full Details" button appears (confirms drawer has content)
		const viewDetailsButton = page.locator('a:has-text("View Full Details")');
		await expect(viewDetailsButton).toBeVisible({ timeout: 10000 });

		// Verify the correct merchant is displayed
		const merchantHref = await viewDetailsButton.getAttribute('href');
		expect(merchantHref).toContain('/merchant/6556');
	});

	test('drawer opens from URL hash on initial page load (mobile)', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate directly to map with merchant hash parameter
		await page.goto('/map#15/53.55573/10.00825&merchant=6556', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for mobile drawer to open (appears at bottom)
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });

		// Wait for merchant data
		try {
			await page.waitForResponse(
				(response) =>
					response.url().includes('api.btcmap.org/v4/places/6556') && response.status() === 200,
				{ timeout: 10000 }
			);
		} catch (error) {
			console.error('API response wait failed:', error);
		}

		// Verify drawer has content (merchant should be loaded)
		const drawerContent = drawer.locator('h3, a');
		await expect(drawerContent.first()).toBeVisible({ timeout: 10000 });
	});

	test('boost view opens from hash parameter', async ({ page }) => {
		// Navigate with boost view parameter
		await page.goto('/map#15/53.55573/10.00825&merchant=6556&view=boost', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for drawer to open
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });

		// Verify "Back" button is visible (indicates we're in a nested view like boost)
		const backButton = page.getByRole('button', { name: /back/i });
		await expect(backButton).toBeVisible({ timeout: 10000 });

		// Verify "Boost" text appears in header or content
		const boostText = page.locator('span:has-text("boost"), span:has-text("Boost")');
		await expect(boostText.first()).toBeVisible({ timeout: 10000 });
	});
});
