import { test, expect } from '@playwright/test';
import { waitForMarkersToLoad } from './helpers';

// The page-navigation links (home / add / community / account) now live in
// a modal opened by the ☰ Menu trigger, replacing the old button stack.
test.describe('Map menu', () => {
	const menuButton = (page: import('@playwright/test').Page) =>
		page.getByRole('button', { name: /^menu$/i });

	test('opens a modal with the page-navigation links', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		await expect(menuButton(page)).toBeVisible();
		// Links are not in the DOM until the menu opens.
		await expect(page.getByRole('link', { name: 'Add location' })).toBeHidden();

		await menuButton(page).click();
		const dialog = page.getByRole('dialog', { name: /^menu$/i });
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByRole('link', { name: 'Go to home page' })
		).toBeVisible();
		await expect(dialog.getByRole('link', { name: 'Add location' })).toHaveAttribute(
			'href',
			'/add-location'
		);
		await expect(
			dialog.getByRole('link', { name: 'Community map' })
		).toHaveAttribute('href', '/communities/map');
		// Account row reflects session state (logged out -> Log in / login).
		await expect(dialog.getByRole('link', { name: /log in|account/i })).toBeVisible();
	});
});
