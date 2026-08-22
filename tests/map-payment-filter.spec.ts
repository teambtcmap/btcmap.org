import { test, expect } from '@playwright/test';
import { MARKER_LOAD_TIMEOUT, waitForMarkersToLoad } from './helpers';

// Regression guard for the /map payment deep links (?onchain&lightning&nfc)
// the Embedding wiki documents for iframe embeds (e.g. boltcard.org). The
// original params were silently lost in a map rewrite (#398) because nothing
// pinned their behavior — these tests exist so that can't happen again.
// See #1269.
test.describe('Map payment method filters', () => {
	const placesCount = (page: import('@playwright/test').Page) =>
		page.evaluate(
			() => (window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount ?? 0
		);

	const nearbyListCount = (page: import('@playwright/test').Page) =>
		page.evaluate(
			() => (window as unknown as { __nearbyListCount?: number }).__nearbyListCount ?? 0
		);

	test('?lightning narrows the rendered places once payment tags load', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		// Baseline: unfiltered world view.
		await page.goto('/map', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		const baseline = await placesCount(page);
		expect(baseline).toBeGreaterThan(0);

		// Deep link: the filter engages after the one-time payment-tag
		// enrichment fetch lands, so poll until the count settles below the
		// baseline (lightning=yes is ~79% of places at the time of writing,
		// so 95% leaves ample headroom for data drift).
		await page.goto('/map?lightning', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		await expect
			.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT })
			.toBeLessThan(baseline * 0.95);
		expect(await placesCount(page)).toBeGreaterThan(0);
	});

	test('the nearby list narrows with the pins', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		// San Salvador center at zoom 15: dense (~250 places) with a small
		// nfc=yes minority (~12% at the time of writing), so both directions
		// of the assertion have wide drift headroom. Zoom 15 uses the
		// local-markers list path even WITHOUT a deep link, giving an
		// unfiltered baseline for the same viewport.
		const CITY_HASH = '#15/13.7000/-89.2240';

		await page.goto(`/map${CITY_HASH}`, { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		await expect
			.poll(() => nearbyListCount(page), { timeout: MARKER_LOAD_TIMEOUT })
			.toBeGreaterThan(0);
		const unfiltered = await nearbyListCount(page);

		// Same viewport with ?nfc: the deep link must narrow the nearby list
		// too, not just the pins — the panel would otherwise contradict the
		// embed's filtered map. A dropped list pre-filter leaves the count at
		// ~unfiltered; a dropped local-markers forcing never sets the hook.
		await page.goto(`/map?nfc${CITY_HASH}`, { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		await expect
			.poll(
				async () => {
					const count = await nearbyListCount(page);
					return count > 0 && count < unfiltered * 0.5;
				},
				{ timeout: MARKER_LOAD_TIMEOUT }
			)
			.toBe(true);
	});

	test('?nfc maps to lightning_contactless and combined params AND together', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });

		await page.goto('/map', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		const baseline = await placesCount(page);
		expect(baseline).toBeGreaterThan(0);

		// ?nfc requires payment:lightning_contactless=yes — a small subset
		// (~12% at the time of writing; 50% leaves headroom for drift).
		await page.goto('/map?nfc', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		await expect
			.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT })
			.toBeLessThan(baseline * 0.5);
		const nfcCount = await placesCount(page);
		expect(nfcCount).toBeGreaterThan(0);

		// AND semantics: adding ?lightning can only narrow the set further
		// (or keep it equal), never widen it.
		await page.goto('/map?nfc&lightning', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		await expect
			.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT })
			.toBeLessThan(baseline * 0.5);
		expect(await placesCount(page)).toBeLessThanOrEqual(nfcCount);
		expect(await placesCount(page)).toBeGreaterThan(0);
	});
});
