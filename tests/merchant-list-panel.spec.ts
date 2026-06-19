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

	test('single search input is visible on map load, no mode toggle anywhere', async ({ page }) => {
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

		// Floating search bar should be visible with the neutral places placeholder
		// (loose match so copy/i18n tweaks don't break the behavioral test)
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await expect(searchInput).toHaveAttribute('placeholder', /search places/i);

		// The Worldwide/Nearby mode toggle has been removed entirely — assert the
		// scope radios are absent (not merely hidden) via toHaveCount(0).
		await expect(page.getByRole('radio', { name: 'Worldwide' })).toHaveCount(0);
		await expect(page.getByRole('radio', { name: /nearby/i })).toHaveCount(0);
	});

	test('list panel opens via search input focus and shows nearby merchants', async ({ page }) => {
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

		// List panel should now be visible with the nearby browse list (empty
		// input → nearby), so merchant rows appear
		await expect(listPanel).toBeVisible({ timeout: 10000 });
		await expect(listPanel.locator('li button').first()).toBeVisible({ timeout: 15000 });

		// Desktop surfaces the nearby count inside the open panel (the floating
		// bar + its pill unmount when the panel opens). Allow the capped ">250"
		// form as well as a plain number so a dense dataset can't make this flaky.
		await expect(listPanel.getByText(/>?\d+\s+nearby/i)).toBeVisible({ timeout: 10000 });
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

		// Tap the facade to expand the sheet into the full panel
		await facade.click();

		// Panel content appears: real search input + nearby list (no mode toggle —
		// assert the scope radios are absent, not merely hidden)
		await expect(listPanel.locator('input[type="search"]')).toBeVisible({ timeout: 5000 });
		await expect(listPanel.getByRole('radio', { name: 'Worldwide' })).toHaveCount(0);
		await expect(listPanel.getByRole('radio', { name: /nearby/i })).toHaveCount(0);
		await expect(listPanel.locator('li button').first()).toBeVisible({ timeout: 15000 });

		// Collapse with Escape — the peek facade returns carrying the count pill
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

		// Mobile drawer should open (the merchant details dialog)
		const mobileDrawer = page.getByRole('dialog', { name: 'Merchant details' });
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

		// Wait for drawer to open (the merchant details dialog)
		const mobileDrawer = page.getByRole('dialog', { name: 'Merchant details' });
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

	test('typing searches worldwide; clearing returns to the nearby list', async ({ page }) => {
		// Desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		// Navigate to map (Tbilisi area)
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for map to initialize
		const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
		await expect(zoomInButton).toBeVisible();

		// Wait for markers to load
		await waitForMarkersToLoad(page);

		// Open the panel via the search input
		const searchInput = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchInput).toBeVisible({ timeout: 15000 });
		await searchInput.click();

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });
		// Nearby browse list is shown at rest
		await expect(listPanel.locator('li button').first()).toBeVisible({ timeout: 15000 });

		// The "Show all on map" button is search-mode only — absent while browsing
		const showAll = listPanel.getByRole('button', { name: /show all|zoom map to show/i });
		await expect(showAll).toHaveCount(0);

		// Type a place far from here → worldwide search results appear. Arm the
		// response waiter BEFORE typing so a fast response can't land first.
		const panelInput = listPanel.locator('input[type="search"]');
		const searchResponse = page.waitForResponse(
			(r) => r.url().includes('/api/search/places') && r.ok(),
			{ timeout: 15000 }
		);
		await panelInput.fill('El Zonte');
		await searchResponse;
		// Search mode is active → the Show-all-on-map control appears
		await expect(listPanel.getByRole('button', { name: /show all/i })).toBeVisible({
			timeout: 10000
		});

		// Clear the input → back to nearby browse (Show-all gone, rows return)
		await listPanel.getByRole('button', { name: /clear search/i }).click();
		await expect(listPanel.getByRole('button', { name: /show all/i })).toHaveCount(0);
		await expect(listPanel.locator('li button').first()).toBeVisible({ timeout: 15000 });
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

		// The floating bar unmounts when the panel opens — the panel renders its
		// own input in the same slot. Both share the accessible name, so assert
		// there's exactly one search box now and it lives inside the panel.
		const searchboxes = page.getByRole('searchbox', { name: /search for bitcoin merchants/i });
		await expect(searchboxes).toHaveCount(1);
		await expect(listPanel.locator('input[type="search"]')).toBeVisible();

		// Close the panel using the close button
		const closeButton = listPanel.getByRole('button', { name: /close merchant list/i });
		await closeButton.click();

		// Panel should close
		await expect(listPanel).not.toBeVisible({ timeout: 5000 });

		// Floating search bar reappears (the search box is outside the panel again)
		await expect(floatingSearchInput).toBeVisible({ timeout: 5000 });
	});
});
