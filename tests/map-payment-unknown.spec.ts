import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, waitForMarkersToLoad } from './helpers';

// An OSM payment tag is yes, no, or absent, and the filter used to read
// absent as a refusal — so places nobody has tagged vanished from every
// ?onchain/?lightning/?nfc view (#1423). The result set stays evidence-based,
// but an EMPTY filtered view no longer claims "no merchants visible" when the
// truth is that nobody has recorded it here. Hermetic: one fixture place per
// tag state, so the reported number is exact rather than drifting with live
// data.
test.describe('Map payment filter — unknown tags', () => {
	test.use({ serviceWorkers: 'block' });

	const PLACES = [
		{ id: 1, lat: 42.2762, lon: 42.7024, icon: 'restaurant', name: 'Contactless Cafe' },
		{ id: 2, lat: 42.277, lon: 42.703, icon: 'restaurant', name: 'Refused Shop' },
		{ id: 3, lat: 42.2755, lon: 42.7018, icon: 'cafe', name: 'Untagged Bar' }
	];

	// `only` is OSM's most emphatic yes and must match; `no` is a recorded
	// refusal (excluded, and never counted as an unknown); a place absent from
	// the payload has nothing recorded — the case that used to disappear
	// silently. At least one tagged row is required, or ensurePaymentMethods
	// refuses to latch the readiness flag on a degenerate payload.
	const ONE_MATCH = [
		{ id: 1, 'osm:payment:lightning_contactless': 'only' },
		{ id: 2, 'osm:payment:lightning_contactless': 'no' }
	];
	const NO_MATCH = [{ id: 2, 'osm:payment:lightning_contactless': 'no' }];

	const NOT_CHECKED = /places haven't been checked/;

	// isMobile is locked at init from window.innerWidth, so the viewport has
	// to be set before goto or the mobile peek never mounts.
	const PHONE = { width: 375, height: 667 };
	const DESKTOP = { width: 1280, height: 720 };

	const openMap = async (
		page: Page,
		{
			params,
			rows,
			viewport = DESKTOP
		}: {
			params: string;
			rows: unknown[];
			viewport?: { width: number; height: number };
		}
	) => {
		await stubMapData(page, PLACES);
		// Narrow on purpose: the radius search and the bulk update check also
		// carry osm:payment in their `fields`, and answering those with this
		// payload feeds the list rows that have no lat/lon. The enrichment is
		// the only call on /v4/places (no /search/) whose fields start with
		// id,osm:payment.
		await page.route(
			(u) =>
				u.hostname === 'api.btcmap.org' &&
				u.pathname === '/v4/places' &&
				(u.searchParams.get('fields') ?? '').startsWith('id,osm:payment'),
			(route) =>
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(rows)
				})
		);
		await page.setViewportSize(viewport);
		await page.goto(`/map${params}#17/42.2762511/42.7024218`, { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });
	};

	const placesCount = (page: Page) =>
		page.evaluate(
			() => (window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount ?? 0
		);

	// Zoom 17 is the local-marker path (MERCHANT_LIST_MIN_ZOOM is 15): the rows
	// come from the bulk feed via the page, so this is the path where the count
	// depends on the page handing the store rows it can still filter.
	test('an empty filtered view says nobody has checked, not that nothing is here', async ({
		page
	}) => {
		await openMap(page, { params: '?nfc', rows: NO_MATCH });

		// The filter engages once the enrichment lands, so poll to empty.
		await expect.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT }).toBe(0);

		await page.getByRole('button', { name: /search places/i }).click();
		// Two of the three fixture places have nothing recorded; the third is a
		// recorded refusal and must NOT be counted among them.
		await expect(page.getByText(NOT_CHECKED)).toHaveText(
			/Nothing here is recorded as accepting these payments\. 2 places haven't been checked\./
		);
		// The misleading line it replaces is gone.
		expect(await page.getByText('No merchants visible in current view').count()).toBe(0);
	});

	test('says nothing extra while the filtered view has results', async ({ page }) => {
		await openMap(page, { params: '?nfc', rows: ONE_MATCH });

		// `only` matches, the refusal and the untagged place do not.
		await expect.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT }).toBe(1);

		await page.getByRole('button', { name: /search places/i }).click();
		// Asserted through the panel's own count line, not merchant names:
		// names come from the enrichment cache, which a hermetic run leaves
		// empty.
		await expect(page.getByText('1 nearby')).toBeVisible();
		// One-shot count, not a retrying assertion: toBeHidden() would happily
		// wait out a message that renders a moment later.
		expect(await page.getByText(NOT_CHECKED).count()).toBe(0);
	});

	test('leaves the unfiltered view alone', async ({ page }) => {
		await openMap(page, { params: '', rows: ONE_MATCH });

		await page.getByRole('button', { name: /search places/i }).click();
		await expect(page.getByText('3 nearby')).toBeVisible();
		expect(await page.getByText(NOT_CHECKED).count()).toBe(0);
	});

	// #1427. The message above is the one #1424 wrote for someone handed a
	// filtered embed link — and it lived where that person never looks. At
	// rest the list is a peek sheet on mobile and unmounted on desktop, so
	// the whole message was gated behind a tap nobody had a reason to make.
	// These run at both widths precisely because the desktop-only suite above
	// is how the gap survived.
	test('the mobile peek states the empty filtered view without being opened', async ({
		page
	}) => {
		await openMap(page, { params: '?nfc', rows: NO_MATCH, viewport: PHONE });

		await expect.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT }).toBe(0);

		// No tap: the message has to be readable at rest.
		await expect(page.getByText(NOT_CHECKED)).toHaveText(
			/Nothing here is recorded as accepting these payments\. 2 places haven't been checked\./
		);
		// ...and the sheet must still be collapsed. The peek renders the
		// facade only; the real input belongs to the expanded panel.
		expect(await page.locator('input[type="search"]').count()).toBe(0);
		await expect(
			page.getByRole('button', { name: /search places/i })
		).toBeVisible();
	});

	test('the desktop search bar states the empty filtered view at rest', async ({
		page
	}) => {
		await openMap(page, { params: '?nfc', rows: NO_MATCH });

		await expect.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT }).toBe(0);

		// The panel is not mounted at all until it is opened, so this has to
		// come from the floating facade.
		await expect(page.getByText(NOT_CHECKED)).toHaveText(
			/Nothing here is recorded as accepting these payments\. 2 places haven't been checked\./
		);
		expect(await page.locator('input[type="search"]').count()).toBe(0);
	});

	// The guard on #1424's decision: a running tally on every filtered view
	// was rejected as noise to a visitor looking for somewhere to spend. The
	// note belongs to the empty state and nowhere else.
	test('the peek stays quiet while the filtered view has results', async ({
		page
	}) => {
		await openMap(page, { params: '?nfc', rows: ONE_MATCH, viewport: PHONE });

		await expect.poll(() => placesCount(page), { timeout: MARKER_LOAD_TIMEOUT }).toBe(1);

		// One-shot count, not toBeHidden(): a retrying assertion would wait
		// out a note that renders a moment later and call it absent.
		expect(await page.getByText(NOT_CHECKED).count()).toBe(0);
	});
});
