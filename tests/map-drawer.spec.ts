import { test, expect } from '@playwright/test';

test.describe('Map Drawer', () => {
	test('drawer opens on marker click and navigates to merchant detail page', async ({ page }) => {
		test.setTimeout(180000);
		await page.goto('http://127.0.0.1:5173/map#16/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait longer for map initialization and marker loading
		await page.waitForTimeout(15000);

		const findAndClickMarker = async () => {
			// Wait for markers to actually exist in DOM
			await page.waitForFunction(
				() => {
					const markers = document.querySelectorAll('.leaflet-marker-pane > div');
					return markers.length > 0;
				},
				{ timeout: 30000 }
			);

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
		console.log('Found merchant link:', merchantHref);

		await viewDetailsButton.click();

		await expect(page).toHaveURL(/\/merchant\//);

		const timeout = process.env.CI ? 30000 : 10000;
		await expect(page.getByText('Last Surveyed')).toBeVisible({ timeout });
		await expect(page.getByRole('heading', { name: 'Boost' })).toBeVisible();
		await expect(page.getByText('Comments').first()).toBeVisible();
	});

	test('drawer shows Comments button with count', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/map#15/13.6929/-89.2182', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait longer for markers to load
		await page.waitForTimeout(15000);

		// Wait for markers to exist
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: 30000 }
		);

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
});
