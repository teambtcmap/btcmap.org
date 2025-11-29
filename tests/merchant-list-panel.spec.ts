import { test, expect } from '@playwright/test';

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

	test('list panel appears when zoomed in above threshold', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map at zoom level 15 (below threshold)
		await page.goto('/map#15/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();
		await page.waitForTimeout(10000);

		// List panel should NOT be visible at zoom 15
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).not.toBeVisible();

		// Zoom in twice to get to zoom 17 (above threshold)
		await zoomInButton.click();
		await page.waitForTimeout(2000);
		await zoomInButton.click();
		await page.waitForTimeout(5000);

		// Wait for markers to load at new zoom level
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: 30000 }
		);

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
		await page.waitForTimeout(10000);

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: 45000 }
		);

		// Wait for list panel to appear
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 15000 });

		// Wait for merchant items to load (skeleton should disappear)
		await page.waitForTimeout(5000);

		// Find and click first merchant item in list
		const merchantItems = listPanel.locator('li button');
		const firstMerchant = merchantItems.first();
		await expect(firstMerchant).toBeVisible({ timeout: 10000 });

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

		// Drawer should open
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 10000 });

		// Drawer should have View Full Details button
		const viewDetailsButton = page.locator('a:has-text("View Full Details")');
		await expect(viewDetailsButton).toBeVisible({ timeout: 10000 });
	});

	test('list panel only visible on desktop', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom where list would appear on desktop
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();
		await page.waitForTimeout(10000);

		// Wait for markers to load
		await page.waitForFunction(
			() => {
				const markers = document.querySelectorAll('.leaflet-marker-pane > div');
				return markers.length > 0;
			},
			{ timeout: 45000 }
		);

		// List panel should NOT be visible on mobile even at high zoom
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).not.toBeVisible();

		// Wait a bit more to ensure it doesn't appear
		await page.waitForTimeout(3000);
		await expect(listPanel).not.toBeVisible();
	});
});
