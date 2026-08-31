import { expect, test } from '@playwright/test';

import { stubMapData } from './helpers';

test.describe('Home Page', () => {
	// The CTA lands in the map's placement mode (#1134) — stub the map's
	// data so the hop stays hermetic.
	test.use({ serviceWorkers: 'block' });

	test('add location opens placement mode on the map', async ({ page }) => {
		await stubMapData(page);
		await page.goto('');

		await page.waitForLoadState('domcontentloaded');

		const heading = page.getByRole('heading', {
			name: 'Find places to spend sats wherever you are'
		});
		await expect(heading).toBeVisible();

		await page.getByRole('link', { name: 'Add Location' }).click();

		await expect(page).toHaveURL(/\/map\?add=/);
		await expect(page.getByText('Place the pin', { exact: true })).toBeVisible();
	});
});
