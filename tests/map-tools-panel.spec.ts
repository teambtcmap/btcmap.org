import { test, expect } from '@playwright/test';
import { STUB_PLACES, stubMapData, waitForMarkersToLoad } from './helpers';

// The consolidated "Layers & filters" panel: one trigger button opens a
// modal with basemap, verified-filter, overlay (heatmap + boost) and view
// (globe) sections.
//
// Hermetic exemplar (#1185): all btcmap data requests are stubbed, so this
// spec is deterministic and independent of API/CDN availability. Blocking
// service workers is load-bearing — the prod build's SW does not bypass the
// CDN host, and SW-mediated fetches are invisible to page.route.
test.describe('Map tools panel', () => {
	test.use({ serviceWorkers: 'block' });

	const toolsButton = (page: import('@playwright/test').Page) =>
		page.getByRole('button', { name: /layers & filters/i });

	test('opens a modal with every section, then closes', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await stubMapData(page);
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page, { skipApiWait: true });

		// The fixture is the whole world: the rendered count is exact — the
		// hermeticity payoff (with live data this was nondeterministic).
		expect(
			await page.evaluate(
				() => (window as unknown as { __mapPlacesCount: number }).__mapPlacesCount
			)
		).toBe(STUB_PLACES.length);

		await expect(toolsButton(page)).toBeVisible();
		await toolsButton(page).click();

		const dialog = page.getByRole('dialog', { name: /layers & filters/i });
		await expect(dialog).toBeVisible();
		// One representative control per section.
		await expect(dialog.getByRole('radio', { name: 'OpenStreetMap' })).toBeVisible();
		await expect(dialog.getByRole('radio', { name: 'Any' })).toBeVisible();
		await expect(dialog.getByRole('radio', { name: 'Outdated only' })).toBeVisible();
		await expect(
			dialog.getByRole('switch', { name: /toggle merchant density heatmap/i })
		).toBeVisible();
		await expect(dialog.getByRole('switch', { name: /boosted locations only/i })).toBeVisible();
		await expect(dialog.getByRole('switch', { name: /globe view/i })).toBeVisible();

		// Escape closes.
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});
});
