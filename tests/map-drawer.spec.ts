import { test, expect } from '@playwright/test';
import {
	waitForMarkersToLoad,
	setupConsoleErrorCollection,
	checkForConsoleErrors
} from './helpers';

test.describe('Map Drawer', () => {
	// Collect console errors during tests - map JS errors should fail the test
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	test('drawer opens via URL hash and "See full profile" navigates to merchant detail page', async ({
		page
	}) => {
		test.setTimeout(180000);
		// MapLibre draws pins on a WebGL canvas, so the test can't probe
		// DOM markers the way the legacy Leaflet suite did. Use the URL
		// drawer pathway instead — `?merchant=` opens the drawer the same
		// way a marker click does.
		await page.goto('/map?merchant=6556#15/53.55573/10.00825', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		await waitForMarkersToLoad(page);

		// Wait for drawer to open
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });

		// Look for "See full profile" button in drawer
		const viewDetailsButton = page.locator('a:has-text("See full profile")');
		await expect(viewDetailsButton).toBeVisible({ timeout: 10000 });

		const merchantHref = await viewDetailsButton.getAttribute('href');
		expect(merchantHref).toContain('/merchant/6556');

		await viewDetailsButton.click();

		await expect(page).toHaveURL(/\/merchant\//);

		const timeout = process.env.CI ? 30000 : 10000;
		await expect(page.getByText('Verify Location')).toBeVisible({ timeout });
		await expect(page.locator('#boost-button')).toBeVisible();
		await expect(page.getByText('Comments').first()).toBeVisible();
	});

	test('drawer shows Comments button with count', async ({ page }) => {
		// Use a merchant we know has comments — `?merchant=` opens the
		// drawer without needing to click a WebGL-canvas pin.
		await page.goto('/map?merchant=6556#15/53.55573/10.00825', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		await waitForMarkersToLoad(page);

		// Check drawer comments button
		const commentsButton = page.locator('a[href*="#comments"]');
		await expect(commentsButton).toBeVisible({ timeout: 10000 });

		await expect(commentsButton).toContainText('Comments');

		const commentCountSpan = commentsButton.locator('span.text-sm').first();
		await expect(commentCountSpan).toBeVisible();

		const countText = await commentCountSpan.textContent();
		const trimmedCount = countText?.trim() || '';
		expect(trimmedCount).toMatch(/^\d+$/);
	});

	test('drawer opens from URL query param on initial page load (desktop)', async ({ page }) => {
		// Navigate directly to map with merchant query parameter
		await page.goto('/map?merchant=6556#15/53.55573/10.00825', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load before query parameter can trigger drawer
		await waitForMarkersToLoad(page);

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

		// Verify "See full profile" button appears (confirms drawer has content)
		const viewDetailsButton = page.locator('a:has-text("See full profile")');
		await expect(viewDetailsButton).toBeVisible({ timeout: 10000 });

		// Verify the correct merchant is displayed
		const merchantHref = await viewDetailsButton.getAttribute('href');
		expect(merchantHref).toContain('/merchant/6556');
	});

	test('drawer opens from URL query param on initial page load (mobile)', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate directly to map with merchant query parameter
		await page.goto('/map?merchant=6556#15/53.55573/10.00825', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load before query parameter can trigger drawer
		await waitForMarkersToLoad(page);

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

	test('boost view opens from query parameter', async ({ page }) => {
		// Navigate with boost view parameter
		await page.goto('/map?merchant=6556&view=boost#15/53.55573/10.00825', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load before query parameter can trigger drawer
		await waitForMarkersToLoad(page);

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

	test('comments re-appear after switching to merchant without comments and back', async ({
		page
	}) => {
		let commentsFetchCount = 0;

		// Mock the comments API: merchant 6556 has comments, others return empty
		await page.route('**/v4/places/*/comments', async (route) => {
			commentsFetchCount++;
			const url = route.request().url();
			if (url.includes('/places/6556/')) {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([
						{ id: 1, text: 'Great place!', created_at: '2025-01-15T12:00:00Z' }
					])
				});
			} else {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([])
				});
			}
		});

		// Mock the single-place API so both merchants resolve with appropriate comment counts
		await page.route('**/v4/places/6556', async (route) => {
			const response = await route.fetch();
			const json = await response.json();
			json.comments = 1;
			await route.fulfill({ response, json });
		});
		await page.route('**/v4/places/1', async (route) => {
			const response = await route.fetch();
			const json = await response.json();
			json.comments = 0;
			await route.fulfill({ response, json });
		});

		// Open merchant 6556 (has comments)
		await page.goto('/map?merchant=6556#15/53.55573/10.00825', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });

		// Verify comments appear
		await expect(drawer.getByText('Great place!')).toBeVisible({ timeout: 10000 });
		const firstFetchCount = commentsFetchCount;
		expect(firstFetchCount).toBeGreaterThanOrEqual(1);

		// Switch to merchant 1 (no comments)
		await page.evaluate(() => {
			history.pushState(null, '', '/map?merchant=1#15/53.55573/10.00825');
			window.dispatchEvent(new Event('merchant-url-change'));
		});

		// Wait for drawer to update — comments should be gone
		await expect(drawer.getByText('Great place!')).not.toBeVisible({ timeout: 10000 });

		// Switch back to merchant 6556
		await page.evaluate(() => {
			history.pushState(null, '', '/map?merchant=6556#15/53.55573/10.00825');
			window.dispatchEvent(new Event('merchant-url-change'));
		});

		// Comments must re-appear (this is the bug scenario)
		await expect(drawer.getByText('Great place!')).toBeVisible({ timeout: 10000 });

		// Verify a new fetch was triggered
		expect(commentsFetchCount).toBeGreaterThan(firstFetchCount);
	});

	test('drawer dismisses on swipe down from peek state (mobile)', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate with merchant query param to open drawer directly
		await page.goto('/map?merchant=6556#15/53.55573/10.00825', { waitUntil: 'load' });

		// Wait for map to load
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load before query parameter can trigger drawer
		await waitForMarkersToLoad(page);

		// Wait for drawer to open
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });

		// Get drawer position
		const box = await drawer.boundingBox();
		if (!box) throw new Error('Drawer not found');

		// Simulate swipe down gesture from peek state
		const startX = box.x + box.width / 2;
		const startY = box.y + 20;

		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.mouse.move(startX, startY + 100, { steps: 5 });
		await page.mouse.up();

		// Drawer should be dismissed
		await expect(drawer).not.toBeVisible({ timeout: 5000 });
	});
});
