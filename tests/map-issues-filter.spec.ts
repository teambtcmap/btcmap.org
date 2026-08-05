import { test, expect } from '@playwright/test';
import { MARKER_LOAD_TIMEOUT, waitForMarkersToLoad } from './helpers';

// Regression guard for the /map?issues deep link (the contributor worklist
// view, #921): places with at least one derived issue — never verified,
// verified over a year ago, approaching that boundary, or missing an icon.
// Mirrors the ?outdated spec's structure: the filter engages only after the
// one-time verified_at enrichment fetch lands.
test.describe('Map ?issues filter', () => {
	const placesCount = (page: import('@playwright/test').Page) =>
		page.evaluate(
			() => (window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount ?? 0
		);

	test('?issues narrows the rendered places once verified dates load', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		// Baseline: unfiltered world view.
		await page.goto('/map', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		const baseline = await placesCount(page);
		expect(baseline).toBeGreaterThan(0);

		// Deep link: poll until the count settles below the baseline (the
		// issue set is a strict subset — roughly half of all places at the
		// time of writing, so 95% leaves ample headroom for data drift).
		await page.goto('/map?issues', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		await expect
			.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT })
			.toBeLessThan(baseline * 0.95);
		expect(await placesCount(page)).toBeGreaterThan(0);

		// Deep-link only, session-only: nothing persisted, and the stored
		// verified-filter preference stays untouched.
		const stored = await page.evaluate(() =>
			localStorage.getItem('btcmap-next-verified-filter')
		);
		expect(stored).toBeNull();
	});
});
