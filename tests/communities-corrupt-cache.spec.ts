import { test, expect } from '@playwright/test';

// Regression guard for #1187: a corrupt row in the persisted areas cache (a
// stray "\n" string left behind by a non-JSON API response) crashed the
// communities directory into a silent empty page, forever, for any browser
// whose cache caught it. The sync layer now validates rows at hydrate and the
// render filters guard tags access — this spec pins both by poisoning the
// cache exactly like the field corruption and demanding the page still work.
test.describe('Communities directory with a corrupted cache', () => {
	const cardCount = (page: import('@playwright/test').Page) =>
		page.locator('a[href*="/community/"]').count();

	test('renders and self-heals after a corrupt cached row', async ({ page }) => {
		await page.goto('/communities/africa', { waitUntil: 'load' });

		// First load: areas sync populates the store and persists the cache.
		await expect.poll(() => cardCount(page), { timeout: 60000 }).toBeGreaterThan(0);

		// Wait for the persisted cache to exist, then inject the exact field
		// corruption: the literal string "\n" as an areas row.
		await expect
			.poll(
				() =>
					page.evaluate(
						() =>
							new Promise((resolve) => {
								const open = indexedDB.open('BTC Map');
								open.onsuccess = () => {
									const db = open.result;
									try {
										const tx = db.transaction('keyvaluepairs', 'readonly');
										const get = tx.objectStore('keyvaluepairs').get('areas_v4');
										get.onsuccess = () => {
											const isArray = Array.isArray(get.result);
											db.close();
											resolve(isArray);
										};
										get.onerror = () => {
											db.close();
											resolve(false);
										};
									} catch {
										db.close();
										resolve(false);
									}
								};
								open.onerror = () => resolve(false);
							})
					),
				{ timeout: 30000 }
			)
			.toBe(true);

		await page.evaluate(
			() =>
				new Promise<void>((resolve, reject) => {
					const open = indexedDB.open('BTC Map');
					open.onsuccess = () => {
						const db = open.result;
						const tx = db.transaction('keyvaluepairs', 'readwrite');
						const store = tx.objectStore('keyvaluepairs');
						const get = store.get('areas_v4');
						get.onsuccess = () => {
							const rows = get.result;
							rows.splice(Math.min(900, rows.length), 0, '\n');
							const put = store.put(rows, 'areas_v4');
							put.onsuccess = () => {
								db.close();
								resolve();
							};
							put.onerror = () => reject(put.error);
						};
						get.onerror = () => reject(get.error);
					};
					open.onerror = () => reject(open.error);
				})
		);

		// The reload hydrates from the poisoned cache. Pre-fix this crashed the
		// reactive and rendered zero cards; post-fix the corrupt row is dropped
		// at hydrate and the directory renders normally.
		await page.reload({ waitUntil: 'load' });
		await expect.poll(() => cardCount(page), { timeout: 60000 }).toBeGreaterThan(0);
	});
});
