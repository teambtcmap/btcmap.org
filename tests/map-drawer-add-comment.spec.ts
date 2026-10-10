import { expect, test } from '@playwright/test';

import { checkForConsoleErrors, setupConsoleErrorCollection, waitForMarkersToLoad } from './helpers';

// The map drawer's "Add Comment" entry point (#1489). `POST /v4/place-comments`
// mints a real invoice, so it is always intercepted and aborted: these tests
// stop at the form and never reach the payment step.
const MERCHANT_URL = '/map?merchant=6556#15/53.55573/10.00825';

test.describe('Map drawer — add comment', () => {
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	// Opens the drawer for merchant 6556 with `count` comments on its record
	// and `comments` as the list the comments endpoint returns.
	const openDrawer = async (
		page: import('@playwright/test').Page,
		count: number,
		comments: { id: number; text: string; created_at: string }[]
	) => {
		await page.route('**/v4/places/*/comments', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(comments)
			});
		});
		await page.route('**/v4/places/6556', async (route) => {
			const response = await route.fetch();
			const json = await response.json();
			json.comments = count;
			json.deleted_at = null;
			await route.fulfill({ response, json });
		});
		await page.goto(MERCHANT_URL, { waitUntil: 'load' });
		await waitForMarkersToLoad(page);
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 15000 });
		return drawer;
	};

	test('a place without comments shows the empty state and the entry point', async ({ page }) => {
		const drawer = await openDrawer(page, 0, []);
		await expect(drawer.getByText('No comments yet.')).toBeVisible({ timeout: 10000 });
		await expect(drawer.getByRole('button', { name: 'Add Comment' })).toBeVisible();
	});

	test('the form opens over the drawer; Escape closes only the form', async ({ page }) => {
		let posts = 0;
		await page.route('**/v4/place-comments', async (route) => {
			posts++;
			await route.abort();
		});
		const drawer = await openDrawer(page, 1, [
			{ id: 1, text: 'Great place!', created_at: '2025-01-15T12:00:00Z' }
		]);
		await expect(drawer.getByText('Great place!')).toBeVisible({ timeout: 10000 });

		const trigger = drawer.getByRole('button', { name: 'Add Comment' });
		await trigger.click();

		const modal = page.getByRole('dialog', { name: 'Add Comment' });
		await expect(modal).toBeVisible();
		await expect(page.getByLabel('Your comment')).toBeFocused();

		// Tab stays inside the modal
		for (let i = 0; i < 6; i++) {
			await page.keyboard.press('Tab');
			expect(await modal.evaluate((el) => el.contains(document.activeElement))).toBe(true);
		}

		// Escape closes the form but not the drawer behind it, and focus returns
		await page.keyboard.press('Escape');
		await expect(modal).toBeHidden();
		await expect(drawer.getByText('Great place!')).toBeVisible();
		await expect(trigger).toBeFocused();

		// A second Escape now reaches the drawer
		await page.keyboard.press('Escape');
		await expect(drawer.getByText('Great place!')).toBeHidden();
		expect(posts).toBe(0);
	});

	test('an empty comment is marked inline and posts nothing', async ({ page }) => {
		let posts = 0;
		await page.route('**/v4/place-comments', async (route) => {
			posts++;
			await route.abort();
		});
		const drawer = await openDrawer(page, 0, []);
		await drawer.getByRole('button', { name: 'Add Comment' }).click();

		const comment = page.getByLabel('Your comment');
		await expect(comment).toBeVisible();
		await page.getByRole('button', { name: 'Comment', exact: true }).click();
		await expect(comment).toHaveAttribute('aria-invalid', 'true');
		expect(posts).toBe(0);
	});
});
