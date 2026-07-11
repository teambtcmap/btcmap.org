import { test, expect } from '@playwright/test';
import {
	waitForMarkersToLoad,
	setupConsoleErrorCollection,
	checkForConsoleErrors
} from './helpers';

// Match on the decoded `name` param rather than the raw URL. The search request
// also carries lat/lon now, so the URL no longer ends at the name, and
// URLSearchParams encodes the space in "kiosk hamburg" as "+" rather than "%20".
// Comparing the decoded param is immune to both, and still distinguishes "kiosk"
// from "kiosk hamburg" exactly.
const searchNameIs = (url: string, name: string) =>
	new URL(url).searchParams.get('name') === name;

// The search proxy returns { places, total, hasMore } — `total` is the server's
// full match count, which can exceed the rows it returned.
const searchBody = (places: unknown[] = [], total = places.length) =>
	JSON.stringify({ places, total, hasMore: total > places.length });

test.describe('Merchant List Panel', () => {
	// Collect console errors during tests
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	test('search facade is visible on map load, no mode toggle anywhere', async ({ page }) => {
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

		// The floating surface is a button facade carrying the neutral places copy,
		// not a real input (loose match so copy/i18n tweaks don't break the test).
		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await expect(searchFacade).toContainText(/search places/i);
		// No real search input exists until the panel opens — that's what keeps the
		// on-screen keyboard down on mobile and makes the facade honest on desktop.
		await expect(page.locator('input[type="search"]')).toHaveCount(0);

		// The Worldwide/Nearby mode toggle has been removed entirely — assert the
		// scope radios are absent (not merely hidden) via toHaveCount(0).
		await expect(page.getByRole('radio', { name: 'Worldwide' })).toHaveCount(0);
		await expect(page.getByRole('radio', { name: /nearby/i })).toHaveCount(0);
	});

	test('list panel opens via the search facade and shows nearby merchants', async ({ page }) => {
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
		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await searchFacade.click();

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
		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await searchFacade.click();

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

		// The pill renders inside the button but must stay out of its accessible
		// name: voice control selects elements by the name it announces, and a name
		// that shifted with the nearby count would be unusable. Exact match, so a
		// pill leaking back in ("Search places... 14 nearby") fails here.
		await expect(
			listPanel.getByRole('button', { name: 'Search places...', exact: true })
		).toBeVisible();
		// The count is still announced, as a description rather than a name.
		await expect(listPanel.locator('#search-facade-nearby-count')).toHaveText(/nearby/);
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

		// Open the panel via the search facade
		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await searchFacade.click();

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

	// Pausing mid-phrase (e.g. at the space in "kiosk hamburg") dispatches the
	// debounced search for the first word. Resuming typing before that response
	// lands used to rewrite the input with the in-flight query and reset the
	// caret, eating the characters typed in between ("kiosk hamburg" → "kioskrg").
	test('a slow response for an earlier query does not overwrite what the user typed', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		// Stub the search endpoint with a latency long enough to still be in
		// flight while the second word is typed. Keeps the race deterministic
		// and keeps the real search API out of the test.
		await page.route('**/api/search/places*', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 600));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: searchBody()
			});
		});

		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
		await waitForMarkersToLoad(page);

		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await searchFacade.click();

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });
		const panelInput = listPanel.locator('input[type="search"]');

		// Arm the waiters before typing so the dispatch can't be missed. Match the
		// first word exactly — a substring test would also match "kiosk hamburg".
		const isFirstWord = (url: string) => searchNameIs(url, 'kiosk');
		const firstWordRequest = page.waitForRequest((r) => isFirstWord(r.url()), {
			timeout: 15000
		});
		const firstWordResponse = page.waitForResponse((r) => isFirstWord(r.url()), {
			timeout: 15000
		});

		await panelInput.pressSequentially('kiosk', { delay: 60 });
		// The user's pause at the space: long enough for the 300ms debounce to fire.
		await firstWordRequest;

		// Resume typing while "kiosk" is still in flight. Each keystroke re-arms
		// the debounce, so no newer request dispatches to abort the stale one.
		await panelInput.pressSequentially(' hamburg', { delay: 100 });

		// The stale answer must actually arrive before we can claim it was ignored,
		// otherwise this passes for the wrong reason whenever typing outruns it.
		await firstWordResponse;
		// The next search dispatches 300ms after the last keystroke. Awaiting its
		// response proves the stale one was fully processed, and lets the stubbed
		// route finish instead of being torn down mid-sleep.
		await page.waitForResponse((r) => searchNameIs(r.url(), 'kiosk hamburg'), {
			timeout: 15000
		});

		await expect(panelInput).toHaveValue('kiosk hamburg');
	});

	// The catch path needs the same staleness check as the success path: a failure
	// for an abandoned query must not toast, nor clear the spinner out from under
	// the newer search that is already in flight.
	test('a failed response for an earlier query does not toast or clobber the input', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		// "kiosk" fails slowly; the query the user actually ends up with succeeds.
		await page.route('**/api/search/places*', async (route) => {
			const url = route.request().url();
			await new Promise((resolve) => setTimeout(resolve, 600));
			if (searchNameIs(url, 'kiosk')) {
				await route.fulfill({ status: 502, contentType: 'text/plain', body: 'upstream down' });
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: searchBody()
			});
		});

		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
		await waitForMarkersToLoad(page);

		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await searchFacade.click();

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });
		const panelInput = listPanel.locator('input[type="search"]');

		const isFirstWord = (url: string) => searchNameIs(url, 'kiosk');
		const firstWordRequest = page.waitForRequest((r) => isFirstWord(r.url()), {
			timeout: 15000
		});
		const firstWordResponse = page.waitForResponse((r) => isFirstWord(r.url()), {
			timeout: 15000
		});

		await panelInput.pressSequentially('kiosk', { delay: 60 });
		await firstWordRequest;
		await panelInput.pressSequentially(' hamburg', { delay: 100 });

		await firstWordResponse;
		await page.waitForResponse((r) => searchNameIs(r.url(), 'kiosk hamburg'), {
			timeout: 15000
		});

		// The abandoned 502 is swallowed: input intact, no error toast. (The
		// afterEach console-error check also catches its console.error.)
		await expect(panelInput).toHaveValue('kiosk hamburg');
		// Snapshot the count rather than expect(...).toHaveCount(0): that retries,
		// so it would simply wait out the toast's 4s auto-dismiss and pass.
		expect(await page.getByText(/search temporarily unavailable/i).count()).toBe(0);
	});

	// Activating the desktop facade opens the panel, which unmounts the facade.
	// The panel's own input has to pick focus up, or the click appears to do
	// nothing and typing goes nowhere.
	test('desktop: focus moves to the panel search input when the panel opens', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
		await waitForMarkersToLoad(page);

		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await searchFacade.click();

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// The panel's input, not <body>, holds focus after the swap
		const panelInput = listPanel.locator('input[type="search"]');
		await expect(panelInput).toBeFocused();

		// ...so a single click is enough to start typing. Stay under the 3-char
		// search threshold: this test stubs no routes, and a dispatched query would
		// hit the real API and log a console error on failure.
		await page.keyboard.type('ab');
		await expect(panelInput).toHaveValue('ab');
	});

	// The facade is a button, not a searchbox, so keyboard users reach it with Tab
	// and open it with Enter. Focus must still end up in the panel's real input,
	// otherwise a keyboard user is stranded on an element that no longer exists.
	test('desktop: the search facade opens with the keyboard and lands focus in the input', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
		await waitForMarkersToLoad(page);

		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });

		await searchFacade.focus();
		await expect(searchFacade).toBeFocused();
		await page.keyboard.press('Enter');

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		const panelInput = listPanel.locator('input[type="search"]');
		await expect(panelInput).toBeFocused();

		// Stay under the 3-char search threshold: no route stub, so a dispatched
		// query would hit the real API.
		await page.keyboard.type('ab');
		await expect(panelInput).toHaveValue('ab');
	});

	// The mobile peek facade is a button, and tapping it must not focus the real
	// input — an autofocus there raises the on-screen keyboard over the list.
	test('mobile: opening the sheet does not focus the search input', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });

		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
		await waitForMarkersToLoad(page);

		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 15000 });
		await listPanel.getByRole('button', { name: /search places/i }).click();

		const panelInput = listPanel.locator('input[type="search"]');
		await expect(panelInput).toBeVisible({ timeout: 5000 });
		await expect(panelInput).not.toBeFocused();
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

		// Floating search facade should be visible, and it is the only search
		// surface — no real input exists while the panel is closed. Assert the
		// invariant with a CSS locator, not getByRole('searchbox'): role locators
		// skip hidden elements, so they'd pass on an input that is mounted but
		// hidden — exactly the change someone might make to skip the tick().
		const realInput = page.locator('input[type="search"]');
		const searchFacade = page.getByRole('button', { name: /search places/i });
		await expect(searchFacade).toBeVisible({ timeout: 15000 });
		await expect(realInput).toHaveCount(0);

		// Open the list panel
		await searchFacade.click();

		// List panel should be visible
		const listPanel = page.locator('[role="complementary"][aria-label="Merchant list"]');
		await expect(listPanel).toBeVisible({ timeout: 10000 });

		// The facade unmounts when the panel opens and the panel renders the real
		// input in the same slot: exactly one search box, and it lives in the panel.
		await expect(realInput).toHaveCount(1);
		await expect(listPanel.locator('input[type="search"]')).toBeVisible();
		await expect(searchFacade).toHaveCount(0);

		// Close the panel using the close button
		const closeButton = listPanel.getByRole('button', { name: /close merchant list/i });
		await closeButton.click();

		// Panel should close
		await expect(listPanel).not.toBeVisible({ timeout: 5000 });

		// Floating facade reappears and the real input is gone again
		await expect(searchFacade).toBeVisible({ timeout: 5000 });
		await expect(realInput).toHaveCount(0);
	});
});
