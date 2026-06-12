import { test, expect } from '@playwright/test';
import {
	waitForMarkersToLoad,
	setupConsoleErrorCollection,
	checkForConsoleErrors
} from './helpers';

test.describe('Merchant List Panel', () => {
	// Collect console errors during tests
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	test('single search input is visible on map load, no mode buttons on the map', async ({
		page
	}) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await waitForMarkersToLoad(page);

		// Floating search bar should be visible with the neutral placeholder
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await expect(searchInput).toHaveAttribute('placeholder', 'Search places...');

		// The Worldwide/Nearby scope toggle lives inside the panel only —
		// no mode radios on the map while the panel is closed
		await expect(page.getByRole('radio', { name: 'Worldwide' })).not.toBeVisible();
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
		await waitForMarkersToLoad(page);

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
		await waitForMarkersToLoad(page);

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
		const drawer = page.locator('[role="dialog"]:has(a:has-text("See full profile"))');
		await expect(drawer).toBeVisible({ timeout: 10000 });

		// Drawer should have See full profile button
		const viewDetailsButton = drawer.locator('a:has-text("See full profile")');
		await expect(viewDetailsButton).toBeVisible({ timeout: 10000 });
	});

	test('mobile: peek sheet is visible and expands to the panel on tap', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await waitForMarkersToLoad(page);

		// The bottom sheet rests at peek: grabber + input facade, no real
		// searchbox yet (the facade is a button so the keyboard stays down)
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 15000 });
		const facade = listPanel.getByRole('button', { name: /search places/i });
		await expect(facade).toBeVisible();
		await expect(listPanel.locator('input[type="search"]')).not.toBeVisible();

		// No mode radios at peek — the scope toggle lives inside the open panel
		await expect(page.getByRole('radio', { name: 'Worldwide' })).not.toBeVisible();

		// Tap the facade to expand the sheet into the full panel
		await facade.click();

		// Panel content appears: real search input + scope toggle + list
		await expect(listPanel.locator('input[type="search"]')).toBeVisible({ timeout: 5000 });
		await expect(listPanel.getByRole('radio', { name: 'Worldwide' })).toBeVisible();

		// Wait for merchants so the nearby count is populated, then collapse
		// with Escape — the peek facade returns carrying the count pill
		const firstMerchant = listPanel.locator('li button').first();
		await expect(firstMerchant).toBeVisible({ timeout: 15000 });
		await page.keyboard.press('Escape');
		await expect(listPanel.getByRole('button', { name: /search places/i })).toBeVisible({
			timeout: 5000
		});
		await expect(listPanel).toContainText(/nearby/);
	});

	test('mobile: selecting merchant collapses sheet and opens drawer', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await waitForMarkersToLoad(page);

		// Expand the peek sheet
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 15000 });
		await listPanel.getByRole('button', { name: /search places/i }).click();

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

		// Mobile drawer should open in peek state (shows "Swipe up for details")
		const mobileDrawer = page.locator('text="Swipe up for details"');
		await expect(mobileDrawer).toBeVisible({ timeout: 10000 });

		// The search sheet yields the bottom edge to the drawer entirely
		await expect(listPanel).not.toBeVisible({ timeout: 5000 });
	});

	test('mobile: search sheet hides when merchant drawer is open', async ({ page }) => {
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to map at high zoom
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await waitForMarkersToLoad(page);

		// Peek sheet should be visible initially
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 15000 });

		// Expand the sheet and select a merchant to open the drawer
		await listPanel.getByRole('button', { name: /search places/i }).click();
		const merchantItems = listPanel.locator('li button');
		const firstMerchant = merchantItems.first();
		await expect(firstMerchant).toBeVisible({ timeout: 15000 });
		await firstMerchant.click();

		// Wait for drawer to open
		const mobileDrawer = page.locator('text="Swipe up for details"');
		await expect(mobileDrawer).toBeVisible({ timeout: 10000 });

		// Search sheet should be hidden while the drawer owns the bottom edge
		await expect(listPanel).not.toBeVisible({ timeout: 5000 });

		// Close the drawer by clicking the map (somewhere outside the drawer)
		await page.click('.maplibregl-canvas', { position: { x: 50, y: 50 } });

		// Wait for drawer to close
		await expect(mobileDrawer).not.toBeVisible({ timeout: 5000 });

		// Search sheet should return at peek after the drawer closes
		await expect(listPanel).toBeVisible({ timeout: 5000 });
		await expect(listPanel.getByRole('button', { name: /search places/i })).toBeVisible();
	});

	test('zero nearby matches shows a Search worldwide CTA that switches scope', async ({
		page
	}) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await waitForMarkersToLoad(page);

		// Open the list panel via the search input
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await searchInput.click();

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// Wait for nearby merchants so the filter has something to miss
		await expect(listPanel.locator('li button').first()).toBeVisible({ timeout: 15000 });

		// Type a filter that cannot match anything nearby
		const panelSearchInput = listPanel.locator('input[type="search"]');
		await panelSearchInput.fill('zzzqqqxxx');

		// The Nearby tab carries the filtered count — (0) — and the empty
		// state nudges toward worldwide instead of showing a blank list
		const nearbyRadio = listPanel.getByRole('radio', { name: /nearby/i });
		await expect(nearbyRadio).toContainText('(0)');
		const cta = listPanel.getByRole('button', { name: /search worldwide/i });
		await expect(cta).toBeVisible();

		// The CTA switches scope to Worldwide, carrying the query
		await cta.click();
		const worldwideRadio = listPanel.getByRole('radio', { name: 'Worldwide' });
		await expect(worldwideRadio).toHaveAttribute('aria-checked', 'true');
		await expect(panelSearchInput).toHaveValue('zzzqqqxxx');
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
		await waitForMarkersToLoad(page);

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

		// Nearby is the default mode; the placeholder stays neutral in both
		// modes (single-input metaphor — scope is carried by the toggle)
		await expect(nearbyRadio).toHaveAttribute('aria-checked', 'true');
		const panelSearchInput = listPanel.locator('input[type="search"]');
		await expect(panelSearchInput).toHaveAttribute('placeholder', 'Search places...');

		// Click Worldwide button to switch to search mode
		await worldwideRadio.click();
		await expect(worldwideRadio).toHaveAttribute('aria-checked', 'true');
		await expect(nearbyRadio).toHaveAttribute('aria-checked', 'false');
		await expect(panelSearchInput).toHaveAttribute('placeholder', 'Search places...');

		// Click Nearby button to switch back
		await nearbyRadio.click();
		await expect(nearbyRadio).toHaveAttribute('aria-checked', 'true');
		await expect(worldwideRadio).toHaveAttribute('aria-checked', 'false');
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
		await waitForMarkersToLoad(page);

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
		const closeButton = listPanel.getByRole('button', { name: /close merchant list/i });
		await closeButton.click();

		// Panel should close
		await expect(listPanel).not.toBeVisible({ timeout: 5000 });

		// Floating search bar should reappear
		await expect(floatingSearchInput).toBeVisible({ timeout: 5000 });
	});
});
