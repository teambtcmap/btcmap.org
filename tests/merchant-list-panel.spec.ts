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

	test('list panel opens via toggle button and shows merchants', async ({ page }) => {
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

		// List panel should NOT be visible initially (auto-open disabled)
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).not.toBeVisible();

		// Toggle button should be visible
		const toggleButton = page.getByRole('button', { name: /merchant list/i });
		await expect(toggleButton).toBeVisible({ timeout: 15000 });

		// Click toggle to open the panel
		await toggleButton.click();

		// List panel should now be visible
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// Should show location count in header
		await expect(page.locator('text=/\\d+ locations? in view/')).toBeVisible({ timeout: 5000 });
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

		// Click toggle button to open list panel
		const toggleButton = page.getByRole('button', { name: /merchant list/i });
		await expect(toggleButton).toBeVisible({ timeout: 15000 });
		await toggleButton.click();

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

	test('mobile: list panel opens fullscreen via toggle button', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom where list would appear on desktop
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

		// Toggle button IS visible on mobile (shared button for both mobile and desktop)
		const toggleButton = page.getByRole('button', { name: /merchant list/i });
		await expect(toggleButton).toBeVisible({ timeout: 15000 });

		// List panel should NOT be visible before clicking toggle
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).not.toBeVisible();

		// Click toggle to open fullscreen list on mobile
		await toggleButton.click();

		// List panel (unified component, fullscreen on mobile) should be visible
		await expect(listPanel).toBeVisible({ timeout: 5000 });

		// Should show "Nearby Merchants" heading
		await expect(listPanel.locator('h2:has-text("Nearby Merchants")')).toBeVisible();
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

		// Open mobile list
		const toggleButton = page.getByRole('button', { name: /merchant list/i });
		await expect(toggleButton).toBeVisible({ timeout: 15000 });
		await toggleButton.click();

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
});
