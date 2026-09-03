import type { Page } from '@playwright/test';

export const MARKER_LOAD_TIMEOUT = 60000;

// Deterministic bulk-feed fixture for hermetic map specs (#1185). Fields are
// exactly what the pipeline reads: places.ts wants a non-empty array;
// buildFeatureCollectionFor reads id/lat/lon/icon/comments/boosted_until/
// name; the nearby-list local path reads deleted_at plus lat/lon against the
// buffered viewport. Coordinates sit inside the specs' shared
// #17/42.2762511/42.7024218 viewport so nearby counts are deterministic too.
// verified_at is deliberately absent — matching the real CDN feed.
export const STUB_PLACES = [
	{ id: 1, lat: 42.2762, lon: 42.7024, icon: 'restaurant', name: 'Stub Cafe' },
	{ id: 2, lat: 42.277, lon: 42.703, icon: 'question_mark', name: 'Stub Shop' },
	{
		id: 3,
		lat: 42.2755,
		lon: 42.7018,
		icon: 'cafe',
		name: 'Stub Bar',
		boosted_until: '2099-01-01T00:00:00Z'
	}
];

// Stub every btcmap data request the /map page makes at boot so a spec runs
// hermetically: the CDN bulk feed (GET + the HEAD staleness probe) serves the
// fixture, and every api.btcmap.org /v4/places* call (update check, radius
// search, count, enrichment, verified dates) serves []. A catch-all for both
// data hosts is registered FIRST so the specific routes win (Playwright
// matches routes in reverse registration order) and any request this
// inventory missed gets a stubbed [] instead of a live hit.
//
// IMPORTANT for callers: the prod build registers a service worker whose
// fetch handler does NOT bypass cdn.static.btcmap.org, and page.route cannot
// see SW-mediated fetches — specs using this helper MUST also set
// `test.use({ serviceWorkers: 'block' })`.
export async function stubMapData(page: Page, places: unknown[] = STUB_PLACES) {
	await page.route(
		(u) =>
			(u.hostname === 'api.btcmap.org' || u.hostname === 'cdn.static.btcmap.org') &&
			(u.pathname.startsWith('/v4/') || u.pathname.startsWith('/api/v4/')),
		(route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
	);
	await page.route('https://cdn.static.btcmap.org/api/v4/places.json', async (route) => {
		if (route.request().method() === 'HEAD') {
			// A current Last-Modified keeps the staleness check happy so the
			// update-check cursor stays deterministic.
			await route.fulfill({
				status: 200,
				headers: { 'last-modified': new Date().toUTCString() }
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(places)
		});
	});
	await page.route(
		(u) => u.hostname === 'api.btcmap.org' && u.pathname.startsWith('/v4/places'),
		(route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
	);
}

// Wait for places API response and markers to render on the map.
// MapLibre draws pins on a WebGL canvas (no DOM markers like Leaflet had),
// so DOM-count probes won't work. Use querySourceFeatures on the
// "places" source to detect that real features have flowed in.
// skipApiWait: stubbed specs answer instantly, so the response can land
// before this helper starts listening — the try/catch below would then eat a
// silent 30s. The __mapPlacesCount poll is the real gate either way.
export async function waitForMarkersToLoad(
	page: Page,
	opts: { skipApiWait?: boolean } = {}
) {
	if (!opts.skipApiWait) {
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
	}

	// MapLibre canvas must be present before features can be queried.
	await page.waitForSelector('.maplibregl-canvas', { state: 'visible' });

	// Poll a global hook /map exposes — `window.__mapPlacesCount` is set
	// (with the rendered feature count) inside syncPlacesToSource each
	// time the source is refreshed. The hook is a no-op in prod; tests
	// pin against it.
	await page.waitForFunction(
		() =>
			(window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount !==
			undefined &&
			(window as unknown as { __mapPlacesCount: number }).__mapPlacesCount > 0,
		{ timeout: MARKER_LOAD_TIMEOUT }
	);
}

// Stub the Nominatim reverse lookup the add-location form fires on arrival
// (#1315). The default fixture composes to "Freiheitsstraße 21, 10115
// Berlin"; pass null to answer with Nominatim's unresolvable-point payload
// so a spec exercises the optional-field fallback. Register BEFORE goto —
// the lookup fires from onMount.
export async function stubReverseGeocode(
	page: Page,
	result: Record<string, unknown> | null = {
		address: {
			house_number: '21',
			road: 'Freiheitsstraße',
			city: 'Berlin',
			postcode: '10115'
		}
	}
) {
	await page.route(
		(u) => u.hostname === 'nominatim.openstreetmap.org',
		(route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(result ?? { error: 'Unable to geocode' })
			})
	);
}

// Setup console error collection for a test. Call this in beforeEach hook.
export function setupConsoleErrorCollection(page: Page) {
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
}

// Check for critical console errors and fail if found. Call this in afterEach hook.
export function checkForConsoleErrors(page: Page) {
	const errors = (page as unknown as { _consoleErrors: string[] })._consoleErrors || [];
	// Filter out non-critical errors (resource loading failures, minified JS noise, WebGL initialization)
	const criticalErrors = errors.filter((error) => {
		// Skip single-character errors (minified JS noise)
		if (error.length <= 2) return false;
		if (error.includes('Failed to load resource')) return false;
		if (error.includes('net::ERR_')) return false;
		// Skip WebGL initialization errors (expected in headless browser).
		// When WebGL2 context creation fails, maplibre-gl v6 fires an
		// ErrorEvent carrying a GPUInitializationError whose message starts
		// "WebGL2 is required to display this map"; unhandled, it reaches
		// the console via a single console.error. The v5-era strings
		// ("Failed to initialize WebGL" etc.) no longer exist in v6.
		if (error.includes('WebGL2 is required')) return false;
		// Skip MapLibre/Leaflet errors related to missing WebGL
		if (error.includes("Cannot read properties of undefined (reading 'remove')")) return false;
		return true;
	});
	if (criticalErrors.length > 0) {
		throw new Error(`Console errors detected:\n${criticalErrors.join('\n')}`);
	}
}

/**
 * Mock the boost invoice API to prevent real invoice creation in production.
 * Returns static mock data that matches the production API response structure.
 * This should be called at the beginning of any test that triggers invoice generation.
 */
export async function mockBoostInvoiceAPI(page: Page) {
	await page.route('**/api/boost/invoice/generate', async (route) => {
		const request = route.request();
		const postData = request.postDataJSON();

		// Validate request - return error for missing parameters
		if (!postData.place_id || !postData.days) {
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({
					message: 'Missing required parameters: place_id, days'
				})
			});
			return;
		}

		// Validate request - return error for invalid days
		if (postData.days <= 0) {
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({
					message: 'Invalid days parameter: must be a positive integer (30, 90, or 365)'
				})
			});
			return;
		}

		// Return mock successful response with static invoice data
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				invoice: 'lnbc50000n1pj9x7xzpp5mock1nv01c3t3stm0ck3xam3pl3test1nv01c3x',
				invoice_id: '12345678-1234-1234-1234-123456789abc'
			})
		});
	});
}
