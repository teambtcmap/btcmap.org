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
		// Menu content is not in the DOM until the menu opens.
		await expect(page.getByRole('button', { name: 'Add location' })).toBeHidden();

		await menuButton(page).click();
		const dialog = page.getByRole('dialog', { name: /^menu$/i });
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByRole('link', { name: 'Go to home page' })
		).toBeVisible();
		await expect(
			dialog.getByRole('link', { name: 'Community map' })
		).toHaveAttribute('href', '/communities/map');
		// Account row reflects session state (logged out -> Log in / login).
		await expect(dialog.getByRole('link', { name: /log in|account/i })).toBeVisible();

		// The add row is an action, not a link (#1134): it closes the menu
		// and starts placement mode on the map — confirm sheet plus ?add.
		await dialog.getByRole('button', { name: 'Add location' }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByText('Place the pin')).toBeVisible();
		await expect(page).toHaveURL(/[?&]add=/);
	});

	test('keeps the add row a plain link in ?issues mode', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map?issues#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		await menuButton(page).click();
		const dialog = page.getByRole('dialog', { name: /^menu$/i });
		await expect(dialog).toBeVisible();
		// Placement mode is deliberately unavailable in the issues worklist,
		// so the row falls back to the standalone form.
		await expect(dialog.getByRole('link', { name: 'Add location' })).toHaveAttribute(
			'href',
			'/add-location'
		);
	});
});
