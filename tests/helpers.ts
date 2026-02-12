import type { Page } from '@playwright/test';

export const MARKER_LOAD_TIMEOUT = 60000;

// Wait for places API response and markers to render in DOM
export async function waitForMarkersToLoad(page: Page) {
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
		{ timeout: MARKER_LOAD_TIMEOUT }
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
		// Skip WebGL initialization errors (expected in headless browser)
		if (error.includes('webglcontextcreationerror')) return false;
		if (error.includes('Failed to initialize WebGL')) return false;
		if (error.includes('Could not create a WebGL context')) return false;
		// Skip MapLibre/Leaflet errors related to missing WebGL
		if (error.includes('_getTransformForUpdate')) return false;
		if (error.includes("Cannot read properties of undefined (reading 'remove')")) return false;
		return true;
	});
	if (criticalErrors.length > 0) {
		throw new Error(`Console errors detected:\n${criticalErrors.join('\n')}`);
	}
}
