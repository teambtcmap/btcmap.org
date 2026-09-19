import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
	descriptionAtFocus,
	ERROR_RED,
	recordDescriptionAtFocus,
	stubCaptcha
} from './helpers';

// The community verification report on the Maintain tab reports invalid
// input inline (#1408), with the rules /verify-location uses (#1407). The
// area comes from the server load (the real API, like
// community-area.spec.ts); the captcha and the submission are stubbed, so
// nothing reaches Gitea.
const PAGE = '/community/bitcoin-bulgaria/maintain';
const CONFIRMATION = 'Tick the box, or describe what needs updating.';
const METHOD = 'Tell us how you verified this.';
const CAPTCHA = 'Enter the characters from the image.';

const openForm = async (page: Page) => {
	await stubCaptcha(page);
	const sent: Record<string, unknown>[] = [];
	await page.route('**/api/gitea/issue', async (route) => {
		sent.push(route.request().postDataJSON());
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ number: 42 })
		});
	});
	await page.goto(PAGE);
	const form = page.locator('#verify-form form');
	// Submitting unlocks once the captcha is in.
	await expect(form.getByLabel(/Bot protection/)).toBeEnabled({ timeout: 30000 });
	return { form, sent };
};

test.describe('Verify Community — inline validation', () => {
	// The service worker would answer /captcha before page.route saw it.
	test.use({ serviceWorkers: 'block' });

	test('an empty report is marked field by field, not by the browser', async ({
		page
	}) => {
		const { form, sent } = await openForm(page);
		await expect(form).toHaveAttribute('novalidate', '');
		await expect(form.locator('label[for="updates"]')).toHaveText(
			'Updates needed (If applicable)'
		);

		const box = form.getByRole('checkbox', { name: 'Current information is accurate' });
		await recordDescriptionAtFocus(box);
		await form.getByRole('button', { name: 'Submit Report' }).click();

		// One of the two is required: the rule describes both controls, and
		// focus lands on the first.
		await expect(box).toBeFocused();
		await expect(box).toHaveAttribute('aria-invalid', 'true');
		await expect(box).toHaveAccessibleDescription(CONFIRMATION);
		expect(await descriptionAtFocus(page)).toBe(CONFIRMATION);
		const updates = form.getByLabel('Updates needed');
		await expect(updates).toHaveAttribute('aria-invalid', 'true');
		await expect(updates).toHaveAccessibleDescription(CONFIRMATION);
		await expect(updates).toHaveCSS('border-top-color', ERROR_RED);

		await expect(form.getByLabel('How did you verify this?')).toHaveAccessibleDescription(
			METHOD
		);
		await expect(form.getByLabel(/Bot protection/)).toHaveAccessibleDescription(CAPTCHA);
		// One-shot reads: a retrying check would wait out a toast.
		expect(await page.locator('[data-sonner-toast]').count()).toBe(0);
		expect(sent).toHaveLength(0);

		// Ticking the box settles the rule.
		await box.check();
		await expect(box).not.toHaveAttribute('aria-invalid', 'true');
		await expect(form.getByText(CONFIRMATION)).toBeHidden();
	});

	test('how it was verified and the captcha answer are required, and clear as they are filled', async ({
		page
	}) => {
		const { form, sent } = await openForm(page);
		await form.getByLabel('Updates needed').fill('The Telegram link moved');

		const method = form.getByLabel('How did you verify this?');
		await recordDescriptionAtFocus(method);
		await form.getByRole('button', { name: 'Submit Report' }).click();
		await expect(method).toBeFocused();
		await expect(method).toHaveAttribute('aria-invalid', 'true');
		expect(await descriptionAtFocus(page)).toBe(METHOD);
		await expect(method).toHaveCSS('outline-color', ERROR_RED);
		await method.fill('Asked in their Telegram group');
		await expect(method).not.toHaveAttribute('aria-invalid', 'true');

		const captcha = form.getByLabel(/Bot protection/);
		await recordDescriptionAtFocus(captcha);
		await form.getByRole('button', { name: 'Submit Report' }).click();
		await expect(captcha).toBeFocused();
		expect(await descriptionAtFocus(page)).toBe(CAPTCHA);
		await captcha.fill('abc123');
		await expect(captcha).not.toHaveAttribute('aria-invalid', 'true');
		expect(sent).toHaveLength(0);
	});

	test('a complete report goes out with what was entered', async ({ page }) => {
		const { form, sent } = await openForm(page);
		await form.getByRole('checkbox', { name: 'Current information is accurate' }).check();
		await form.getByLabel('How did you verify this?').fill('Attended a meetup');
		await form.getByLabel(/Bot protection/).fill('abc123');
		await form.getByRole('button', { name: 'Submit Report' }).click();

		await expect.poll(() => sent.length).toBe(1);
		expect(sent[0]).toMatchObject({
			type: 'verify-community',
			accurate: 'Yes',
			updates: '',
			verified: 'Attended a meetup',
			captchaSecret: 'test-captcha-secret',
			captchaTest: 'abc123'
		});
		await expect(page.getByRole('link', { name: 'Issue #42' })).toBeVisible();
	});
});
