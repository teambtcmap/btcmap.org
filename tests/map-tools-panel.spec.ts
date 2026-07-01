import { test, expect } from '@playwright/test';
import { waitForMarkersToLoad } from './helpers';

// The consolidated "Layers & filters" panel: one trigger button opens a
// modal with basemap, verified-filter, overlay (heatmap + boost) and view
// (globe) sections.
test.describe('Map tools panel', () => {
	const toolsButton = (page: import('@playwright/test').Page) =>
		page.getByRole('button', { name: /layers & filters/i });

	test('opens a modal with every section, then closes', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		await expect(toolsButton(page)).toBeVisible();
		await toolsButton(page).click();

		const dialog = page.getByRole('dialog', { name: /layers & filters/i });
		await expect(dialog).toBeVisible();
		// One representative control per section.
		await expect(dialog.getByRole('radio', { name: 'OpenStreetMap' })).toBeVisible();
		await expect(dialog.getByRole('radio', { name: 'Any' })).toBeVisible();
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
