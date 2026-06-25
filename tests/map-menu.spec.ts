import { test, expect } from '@playwright/test';
import { waitForMarkersToLoad } from './helpers';

test.describe('Map menu control', () => {
	const menuButton = (page: import('@playwright/test').Page) =>
		page.getByRole('button', { name: /menu/i });

	test('collapses page links into a menu popup', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/map#17/42.2762511/42.7024218', { waitUntil: 'load' });
		await waitForMarkersToLoad(page);

		const btn = menuButton(page);
		await expect(btn).toBeVisible();
		await expect(btn).toHaveAttribute('aria-expanded', 'false');

		// Links are hidden until the menu is opened.
		await expect(page.getByRole('link', { name: 'Add location' })).toBeHidden();

		await btn.click();
		await expect(btn).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('link', { name: 'Go to home page' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Add location' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Community map' })).toBeVisible();
		// Logged-out account row points at /login.
		await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute(
			'href',
			'/login'
		);
	});
});
