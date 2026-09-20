import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, waitForMarkersToLoad } from './helpers';

// An OSM payment tag is yes, no, or absent, and the filter used to read
// absent as a refusal — so places nobody has tagged vanished from every
// ?onchain/?lightning/?nfc view with no signal that anything was missing
// (#1423). Hermetic: three fixture places, one per tag state, so the note's
// number is exact rather than drifting with live data.
test.describe('Map payment filter — unknown tags', () => {
	test.use({ serviceWorkers: 'block' });

	const PLACES = [
		{ id: 1, lat: 42.2762, lon: 42.7024, icon: 'restaurant', name: 'Contactless Cafe' },
		{ id: 2, lat: 42.277, lon: 42.703, icon: 'restaurant', name: 'Refused Shop' },
		{ id: 3, lat: 42.2755, lon: 42.7018, icon: 'cafe', name: 'Untagged Bar' }
	];

	// What the one-time payment-tag enrichment answers. `only` is OSM's most
	// emphatic yes and must match; `no` is a recorded refusal (excluded, and
	// NOT an unknown); the third place is simply absent from the payload, the
	// case that used to disappear silently. At least one tagged row is
	// required — ensurePaymentMethods refuses to latch on an untagged payload.
	const PAYMENT_ROWS = [
		{ id: 1, 'osm:payment:lightning_contactless': 'only' },
		{ id: 2, 'osm:payment:lightning_contactless': 'no' }
	];

	const openMapWithNfcFilter = async (page: Page) => {
		await stubMapData(page, PLACES);
		// Registered after stubMapData so it wins: Playwright matches routes
		// in reverse registration order, and the helper's catch-all would
		// otherwise answer the enrichment with [].
		await page.route(
			// Narrow on purpose: the radius search and the bulk update check
			// also carry osm:payment in their `fields`, and answering those
			// with this payload feeds the list rows that have no lat/lon.
			// The enrichment is the only call on /v4/places (no /search/)
			// whose fields start with id,osm:payment.
			(u) =>
				u.hostname === 'api.btcmap.org' &&
				u.pathname === '/v4/places' &&
				(u.searchParams.get('fields') ?? '').startsWith('id,osm:payment'),
			(route) =>
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(PAYMENT_ROWS)
				})
		);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map?nfc#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
	};

	test('reports the places excluded for lack of evidence, and keeps refusals out', async ({
		page
	}) => {
		await openMapWithNfcFilter(page);

		// Only the `only` place survives: the filter engages once the
		// enrichment lands, so poll rather than reading once.
		await expect
			.poll(
				() =>
					page.evaluate(
						() =>
							(window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount ?? 0
					),
				{ timeout: MARKER_LOAD_TIMEOUT }
			)
			.toBe(1);

		// The nearby list agrees with the pins. Asserted through the panel's
		// own count line, not merchant names: names come from the enrichment
		// cache, which a hermetic run answers with [].
		await page.getByRole('button', { name: /search places/i }).click();
		await expect(page.getByText('1 nearby')).toBeVisible();

		// The heart of #1423: the untagged place is reported, the refusal is
		// not. Two would mean a recorded `no` is being counted as an unknown;
		// zero would mean the exclusion went silent again — the regression the
		// map page's own pre-filtering caused while this was being built.
		await expect(page.getByText(/hidden: payment not confirmed/)).toHaveText(
			'1 hidden: payment not confirmed'
		);
	});

	test('says nothing when no payment filter is active', async ({ page }) => {
		await stubMapData(page, PLACES);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });

		await page.getByRole('button', { name: /search places/i }).click();
		await expect(page.getByText('3 nearby')).toBeVisible();
		// One-shot count, not a retrying assertion: toBeHidden() would happily
		// wait out a note that renders a moment later.
		expect(await page.getByText(/payment not confirmed/).count()).toBe(0);
	});
});
