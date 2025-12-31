import { test, expect } from '@playwright/test';

const MARKER_LOAD_TIMEOUT = 60000;

test.describe('Merchant List Panel', () => {
	// Collect console errors during tests
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

	test('floating search bar is visible on map load', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load (ensures map is fully ready)
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Floating search bar should be visible
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });

		// Mode toggle buttons should be visible
		const worldwideButton = page.getByRole('button', { name: 'Worldwide' });
		const nearbyButton = page.getByRole('button', { name: /nearby/i });
		await expect(worldwideButton).toBeVisible();
		await expect(nearbyButton).toBeVisible();
	});

	test('list panel opens via search input focus and shows merchants', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map at zoom level 17 (above threshold)
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// List panel should NOT be visible initially
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).not.toBeVisible();

		// Click on search input to open panel
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await searchInput.click();

		// List panel should now be visible
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// Should show location count in header (in Nearby mode)
		await expect(page.locator('text=/Nearby/')).toBeVisible({ timeout: 5000 });
	});

	test('clicking merchant in list opens drawer with correct merchant', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map at high zoom where list should appear
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Click on search input to open list panel
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await searchInput.click();

		// Wait for list panel to appear
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// Find and click first merchant item in list (wait for items to load)
		const merchantItems = listPanel.locator('li button');
		const firstMerchant = merchantItems.first();
		await expect(firstMerchant).toBeVisible({ timeout: 15000 });

		// Click the merchant
		await firstMerchant.click();

		// Wait for API call to complete
		try {
			await page.waitForResponse(
				(response) =>
					response.url().includes('api.btcmap.org/v4/places/') && response.status() === 200,
				{ timeout: 10000 }
			);
		} catch (error) {
			console.error('API response wait failed, but continuing:', error);
		}

		// Drawer should open (use specific selector to exclude mobile list dialog)
		const drawer = page.locator('[role="dialog"]:has(a:has-text("View Full Details"))');
		await expect(drawer).toBeVisible({ timeout: 10000 });

		// Drawer should have View Full Details button
		const viewDetailsButton = drawer.locator('a:has-text("View Full Details")');
		await expect(viewDetailsButton).toBeVisible({ timeout: 10000 });
	});

	test('mobile: floating search bar visible and opens panel on focus', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Floating search bar should be visible on mobile
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });

		// Mode buttons should be visible
		const nearbyButton = page.getByRole('button', { name: /nearby/i });
		await expect(nearbyButton).toBeVisible();

		// List panel should NOT be visible before clicking
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).not.toBeVisible();

		// Click search input to open fullscreen list on mobile
		await searchInput.click();

		// List panel (unified component, fullscreen on mobile) should be visible
		await expect(listPanel).toBeVisible({ timeout: 5000 });
	});

	test('mobile: selecting merchant closes list and opens drawer', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Click search input to open mobile list
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await searchInput.click();

		// Wait for list panel to appear (unified component, fullscreen on mobile)
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 5000 });

		// Find and click first merchant item (wait for items to load)
		const merchantItems = listPanel.locator('li button');
		const firstMerchant = merchantItems.first();
		await expect(firstMerchant).toBeVisible({ timeout: 15000 });
		await firstMerchant.click();

		// Wait for API call
		try {
			await page.waitForResponse(
				(response) =>
					response.url().includes('api.btcmap.org/v4/places/') && response.status() === 200,
				{ timeout: 10000 }
			);
		} catch (error) {
			console.error('API response wait failed, but continuing:', error);
		}

		// List panel should close
		await expect(listPanel).not.toBeVisible({ timeout: 5000 });

		// Mobile drawer should open in peek state (shows "Swipe up for details")
		const mobileDrawer = page.locator('text="Swipe up for details"');
		await expect(mobileDrawer).toBeVisible({ timeout: 10000 });
	});

	test('mobile: search bar hides when merchant drawer is open', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Floating search bar should be visible initially
		const floatingSearchInput = page.getByRole('searchbox', {
			name: /search for bitcoin merchants/i
		});
		await expect(floatingSearchInput).toBeVisible({ timeout: 15000 });

		// Click search input to open list panel
		await floatingSearchInput.click();

		// Wait for list panel to appear
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 5000 });

		// Select a merchant to open the drawer
		const merchantItems = listPanel.locator('li button');
		const firstMerchant = merchantItems.first();
		await expect(firstMerchant).toBeVisible({ timeout: 15000 });
		await firstMerchant.click();

		// Wait for drawer to open
		const mobileDrawer = page.locator('text="Swipe up for details"');
		await expect(mobileDrawer).toBeVisible({ timeout: 10000 });

		// Floating search bar should be hidden when drawer is open (on mobile)
		// The floating search bar uses fixed positioning and is hidden via max-md:hidden when drawer is open
		await expect(floatingSearchInput).not.toBeVisible({ timeout: 5000 });

		// Close the drawer by clicking the map (somewhere outside the drawer)
		await page.click('.leaflet-container', { position: { x: 50, y: 50 } });

		// Wait for drawer to close
		await expect(mobileDrawer).not.toBeVisible({ timeout: 5000 });

		// Floating search bar should be visible again after drawer closes
		await expect(floatingSearchInput).toBeVisible({ timeout: 5000 });
	});

	test('switches between Worldwide and Nearby modes via floating search bar', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Floating search bar buttons should be visible
		const worldwideButton = page.getByRole('button', { name: 'Worldwide' });
		const nearbyButton = page.getByRole('button', { name: /nearby/i });
		await expect(worldwideButton).toBeVisible({ timeout: 15000 });
		await expect(nearbyButton).toBeVisible();

		// Click Worldwide button
		await worldwideButton.click();

		// Search input placeholder should indicate worldwide mode
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toHaveAttribute('placeholder', 'Search worldwide...');

		// Click Nearby button to switch back
		await nearbyButton.click();

		// Search input placeholder should indicate nearby mode
		await expect(searchInput).toHaveAttribute('placeholder', 'Search nearby...');
	});

	test('switches between Worldwide and Nearby modes in panel', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Open the list panel via search input
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await searchInput.click();

		// Wait for list panel
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// Panel mode toggles should be visible (these use role="radio")
		const worldwideRadio = listPanel.getByRole('radio', { name: 'Worldwide' });
		const nearbyRadio = listPanel.getByRole('radio', { name: /nearby/i });
		await expect(worldwideRadio).toBeVisible();
		await expect(nearbyRadio).toBeVisible();

		// Click Worldwide button to switch to search mode
		await worldwideRadio.click();

		// Panel search input should show worldwide placeholder
		const panelSearchInput = listPanel.locator('input[type="search"]');
		await expect(panelSearchInput).toHaveAttribute('placeholder', 'Search worldwide...');

		// Click Nearby button to switch back
		await nearbyRadio.click();

		// Panel search input should show nearby placeholder
		await expect(panelSearchInput).toHaveAttribute('placeholder', 'Search nearby...');
	});

	test('panel can be closed and floating search bar reappears', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: MARKER_LOAD_TIMEOUT }
		);

		// Floating search bar should be visible
		const floatingSearchInput = page.getByRole('searchbox', {
			name: /search for bitcoin merchants/i
		});
		await expect(floatingSearchInput).toBeVisible({ timeout: 15000 });

		// Open the list panel
		await floatingSearchInput.click();

		// List panel should be visible
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// Floating search bar should be hidden when panel is open
		await expect(floatingSearchInput).not.toBeVisible();

		// Close the panel using the close button
		const closeButton = listPanel.getByRole('button', { name: /close panel/i });
		await closeButton.click();

		// Panel should close
		await expect(listPanel).not.toBeVisible({ timeout: 5000 });

		// Floating search bar should reappear
		await expect(floatingSearchInput).toBeVisible({ timeout: 5000 });
	});
});
