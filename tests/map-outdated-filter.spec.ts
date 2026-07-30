import { test, expect } from '@playwright/test';
import { MARKER_LOAD_TIMEOUT, waitForMarkersToLoad } from './helpers';

// Regression guard for the /map?outdated deep link (the re-verification
// worklist view). The original param was silently lost in a map rewrite
// (#307) because nothing pinned its behavior — these tests exist so that
// can't happen again. See #149 / PR #1155.
test.describe('Map ?outdated filter', () => {
	const placesCount = (page: import('@playwright/test').Page) =>
		page.evaluate(
			() => (window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount ?? 0
		);

	test('?outdated narrows the rendered places once verified dates load', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		// Baseline: unfiltered world view.
		await page.goto('/map', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		const baseline = await placesCount(page);
		expect(baseline).toBeGreaterThan(0);

		// Deep link: the filter engages after the one-time verified_at
		// enrichment fetch lands, so poll until the count settles well below
		// the baseline (outdated is a strict subset; ~40% of places at the
		// time of writing, so 95% leaves ample headroom for data drift).
		await page.goto('/map?outdated', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		await expect
			.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT })
			.toBeLessThan(baseline * 0.95);
		expect(await placesCount(page)).toBeGreaterThan(0);

		// The deep link must NOT persist: a shared link can't overwrite the
		// visitor's stored preference.
		const stored = await page.evaluate(() =>
			localStorage.getItem('btcmap-next-verified-filter')
		);
		expect(stored).toBeNull();
	});

	test('modal reflects the deep link and switching away strips the param', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map?outdated', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		await page.getByRole('button', { name: /layers & filters/i }).click();
		const dialog = page.getByRole('dialog', { name: /layers & filters/i });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('radio', { name: 'Outdated only' })).toBeChecked();

		// Switching to Any removes the stale param so a reload doesn't
		// resurrect the filter the user just switched away from.
		await dialog.getByRole('radio', { name: 'Any' }).check();
		await expect(page).not.toHaveURL(/outdated/);
	});
});
