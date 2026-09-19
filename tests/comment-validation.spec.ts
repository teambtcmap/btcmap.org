import { expect, test } from '@playwright/test';

import { descriptionAtFocus, ERROR_RED, recordDescriptionAtFocus } from './helpers';

// The merchant page's comment form reports an empty comment inline
// (#1410), the #1404 way, instead of a toast. The merchant comes from the
// real API (as in merchant-comment-permalink.spec.ts); the comment
// endpoint is intercepted so nothing can mint an invoice on production.
const MERCHANT = '/merchant/1128';
const MESSAGE = 'Write your comment first.';

test.describe('Merchant comment — inline validation', () => {
	test('an empty or blank comment is marked on the field, not toasted', async ({
		page
	}) => {
		let posts = 0;
		await page.route('**/v4/place-comments', async (route) => {
			posts++;
			await route.abort();
		});
		await page.goto(MERCHANT);
		await page.getByRole('button', { name: 'Add Comment' }).click();

		const comment = page.getByLabel('Your comment');
		await expect(comment).toBeVisible();
		await expect(page.locator('form:has(textarea)')).toHaveAttribute('novalidate', '');

		for (const value of ['', '   ']) {
			await comment.fill(value);
			await recordDescriptionAtFocus(comment);
			await page.getByRole('button', { name: 'Comment', exact: true }).click();

			await expect(comment).toBeFocused();
			await expect(comment).toHaveAttribute('aria-invalid', 'true');
			await expect(comment).toHaveAccessibleDescription(MESSAGE);
			expect(await descriptionAtFocus(page)).toBe(MESSAGE);
			await expect(comment).toHaveCSS('border-top-color', ERROR_RED);
			await expect(comment).toHaveCSS('outline-color', ERROR_RED);
			// One-shot read: a retrying check would wait out a toast.
			expect(await page.locator('[data-sonner-toast]').count()).toBe(0);
		}

		await comment.fill('Great coffee, paid over Lightning');
		await expect(comment).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText(MESSAGE)).toBeHidden();
		expect(posts).toBe(0);
	});
});
