import { test, expect } from '@playwright/test';

test.describe('Community Area Pages', () => {
	test('loads community page and redirects to merchants', async ({ page }) => {
		// Reasonable timeout - focus on navigation, not heavy data loading
		test.setTimeout(60000);

		// Navigate directly to a known community (Bitcoin Bulgaria)
		await page.goto('/community/bitcoin-bulgaria');
		await expect(page).toHaveURL(/\/community\/bitcoin-bulgaria\/merchants$/);
		await page.waitForLoadState('domcontentloaded');

		// Verify basic page structure loads (before heavy API data)
		const bodyContent = await page.locator('body').textContent();
		expect(bodyContent).toBeTruthy();
		expect(bodyContent!.length).toBeGreaterThan(100);
	});

	test('handles section navigation', async ({ page }) => {
		// Reasonable timeout - focus on navigation, not heavy data loading
		test.setTimeout(60000);

		const testSections = ['merchants', 'stats', 'activity', 'maintain'];

		for (const section of testSections) {
			await page.goto(`/community/bitcoin-bulgaria/${section}`);

			// Verify URL matches
			await expect(page).toHaveURL(new RegExp(`/community/bitcoin-bulgaria/${section}$`));

			// Don't wait for heavy data loading - just verify navigation works
			await page.waitForLoadState('domcontentloaded');
		}
	});

	test('navigating to a different community refits the map', async ({ page }) => {
		// AreaPage reuses the AreaMap component instance across area-to-area
		// navigation. A bug in this code path (acc93d25 / 352fd1bd) would
		// leave the previous area's polygon outline + pin set on screen.
		// We can't easily probe the WebGL canvas's drawn pins, but we CAN
		// confirm the map container renders + the URL/title update on both
		// navigations — proxies for the reactive having fired without
		// throwing or stalling.
		test.setTimeout(90000);

		await page.goto('/community/bitcoin-bulgaria/merchants');
		await expect(page).toHaveURL(/\/community\/bitcoin-bulgaria\/merchants$/);
		const canvas = page.locator('.maplibregl-canvas');
		await expect(canvas).toBeVisible({ timeout: 30000 });
		const initialBox = await canvas.boundingBox();
		expect(initialBox?.height).toBeGreaterThan(100);

		// Navigate to a different community. Cambridge Bitcoin (UK city) is
		// on a different continent than Bulgaria, so its bbox is
		// unambiguously different — if AreaMap kept the old polygon /
		// pins this is where a visual regression would land.
		await page.goto('/community/cambridge-bitcoin/merchants');
		await expect(page).toHaveURL(/\/community\/cambridge-bitcoin\/merchants$/);
		await expect(canvas).toBeVisible({ timeout: 30000 });
		const secondBox = await canvas.boundingBox();
		expect(secondBox?.height).toBeGreaterThan(100);

		// No console errors collected (handled at test/group level if added).
	});
});
