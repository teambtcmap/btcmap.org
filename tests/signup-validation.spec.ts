import { expect, test } from '@playwright/test';

import { descriptionAtFocus, ERROR_RED, recordDescriptionAtFocus } from './helpers';

// The signup password states its length rule up front and a too-short one
// is marked inline (#1411), like add-location's payment group (#1397):
// the rule's own line turns into the error. No "Please lengthen this
// text" bubble. The account endpoint is intercepted, so nothing is
// created on production.
const RULE = 'Use at least 8 characters.';
const ERROR = 'Use at least 8 characters to continue.';

test.describe('Signup — inline validation', () => {
	test('a too-short password is marked on the field, not by the browser', async ({
		page
	}) => {
		let posts = 0;
		await page.route('**/v4/users**', async (route) => {
			posts++;
			await route.abort();
		});
		await page.goto('/signup');

		const password = page.getByLabel('Password');
		await expect(password).toBeVisible();
		await expect(page.locator('form:has(#signup-password)')).toHaveAttribute(
			'novalidate',
			''
		);
		// The rule is the field's description before anyone submits, and it
		// sits where every form's messages sit: under the label, above the
		// field.
		await expect(password).toHaveAccessibleDescription(RULE);
		const label = page.locator('label[for="signup-password"]');
		const rule = page.locator('#signup-password-rule');
		const underLabel = async () => {
			const [l, r, p] = await Promise.all([
				label.boundingBox(),
				rule.boundingBox(),
				password.boundingBox()
			]);
			return r!.y >= l!.y + l!.height && r!.y + r!.height <= p!.y;
		};
		expect(await underLabel()).toBe(true);

		await page.getByLabel('Username').fill('satoshi');
		await password.fill('short');
		await recordDescriptionAtFocus(password);
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(password).toBeFocused();
		await expect(password).toHaveAttribute('aria-invalid', 'true');
		await expect(password).toHaveAccessibleDescription(ERROR);
		expect(await descriptionAtFocus(page)).toBe(ERROR);
		await expect(password).toHaveCSS('border-top-color', ERROR_RED);
		await expect(password).toHaveCSS('outline-color', ERROR_RED);
		// The error is that same line, still under the label.
		await expect(rule).toHaveText(ERROR);
		expect(await underLabel()).toBe(true);
		expect(posts).toBe(0);

		// Still short: the error stays; long enough: the rule line returns.
		await password.fill('shorter');
		await expect(password).toHaveAccessibleDescription(ERROR);
		await password.fill('long enough');
		await expect(password).not.toHaveAttribute('aria-invalid', 'true');
		await expect(password).toHaveAccessibleDescription(RULE);
		expect(posts).toBe(0);
	});
});
