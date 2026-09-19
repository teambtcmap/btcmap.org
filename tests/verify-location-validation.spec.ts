import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
	descriptionAtFocus,
	ERROR_RED,
	recordDescriptionAtFocus,
	stubCaptcha
} from './helpers';

// /verify-location reports invalid input inline (#1407), the #1404 way:
// `novalidate`, a message under the label that is the field's accessible
// description before focus lands, an error border, and no native bubbles
// or toasts. The merchant comes from the server load (the real API, like
// verify-location.spec.ts); the captcha and the submission are stubbed,
// so nothing reaches Gitea.
const PAGE = '/verify-location?id=node:9135176628';
const CONFIRMATION = "Tick the box, or describe what's outdated.";
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
	// The fields unlock once the merchant and the captcha are in.
	await expect(page.getByLabel('How did you verify this?')).toBeEnabled({
		timeout: 15000
	});
	return sent;
};

const submit = (page: Page) =>
	page.getByRole('button', { name: 'Submit Report' }).click();

test.describe('Verify Location — inline validation', () => {
	// The service worker would answer /captcha before page.route saw it.
	test.use({ serviceWorkers: 'block' });

	test('an empty report is marked field by field, not by the browser', async ({
		page
	}) => {
		const sent = await openForm(page);
		await expect(page.locator('#verify form')).toHaveAttribute('novalidate', '');
		// Every field is named by its label (three of them pointed at ids
		// that didn't exist), and the tag reads once, not "((If applicable))".
		await expect(page.locator('label[for="outdated"]')).toHaveText(
			'Outdated information (If applicable)'
		);

		const box = page.getByRole('checkbox', { name: 'Current information is correct' });
		await recordDescriptionAtFocus(box);
		await submit(page);

		// One of the two is required: the rule describes both controls, and
		// focus lands on the first.
		await expect(box).toBeFocused();
		await expect(box).toHaveAttribute('aria-invalid', 'true');
		await expect(box).toHaveAccessibleDescription(CONFIRMATION);
		expect(await descriptionAtFocus(page)).toBe(CONFIRMATION);
		const outdated = page.getByLabel('Outdated information');
		await expect(outdated).toHaveAttribute('aria-invalid', 'true');
		await expect(outdated).toHaveAccessibleDescription(CONFIRMATION);
		await expect(outdated).toHaveCSS('border-top-color', ERROR_RED);

		const method = page.getByLabel('How did you verify this?');
		await expect(method).toHaveAttribute('aria-invalid', 'true');
		await expect(method).toHaveAccessibleDescription(METHOD);
		const captcha = page.getByLabel(/Bot protection/);
		await expect(captcha).toHaveAttribute('aria-invalid', 'true');
		await expect(captcha).toHaveAccessibleDescription(CAPTCHA);

		// One-shot reads: a retrying check would wait out a toast.
		expect(await page.locator('[data-sonner-toast]').count()).toBe(0);
		expect(sent).toHaveLength(0);
	});

	test('ticking the box or describing the changes clears the confirmation error', async ({
		page
	}) => {
		await openForm(page);
		const box = page.getByRole('checkbox', { name: 'Current information is correct' });
		const outdated = page.getByLabel('Outdated information');
		await submit(page);
		await expect(box).toHaveAccessibleDescription(CONFIRMATION);

		await box.check();
		await expect(box).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText(CONFIRMATION)).toBeHidden();
		// Ticked, the changes field locks, as before.
		await expect(outdated).toBeDisabled();

		// Unticking doesn't bring the error back before the next submit...
		await box.uncheck();
		expect(await page.getByText(CONFIRMATION).count()).toBe(0);
		// ...which flags it again; describing the changes clears it too.
		await submit(page);
		await expect(page.getByText(CONFIRMATION)).toBeVisible();
		await outdated.fill('Closed on Mondays now');
		await expect(page.getByText(CONFIRMATION)).toBeHidden();
		await expect(outdated).not.toHaveAttribute('aria-invalid', 'true');
		await expect(box).toBeDisabled();
	});

	test('how it was verified and the captcha answer are required, and clear as they are filled', async ({
		page
	}) => {
		const sent = await openForm(page);
		await page.getByRole('checkbox', { name: 'Current information is correct' }).check();

		const method = page.getByLabel('How did you verify this?');
		// Whitespace alone says nothing.
		await method.fill('   ');
		await recordDescriptionAtFocus(method);
		await submit(page);
		await expect(method).toBeFocused();
		await expect(method).toHaveAttribute('aria-invalid', 'true');
		await expect(method).toHaveAccessibleDescription(METHOD);
		expect(await descriptionAtFocus(page)).toBe(METHOD);
		// Red while focused: the focus ring mustn't cover the error border.
		await expect(method).toHaveCSS('border-top-color', ERROR_RED);
		await expect(method).toHaveCSS('outline-color', ERROR_RED);
		await method.fill('Visited on Saturday');
		await expect(method).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText(METHOD)).toBeHidden();

		const captcha = page.getByLabel(/Bot protection/);
		await recordDescriptionAtFocus(captcha);
		await submit(page);
		await expect(captcha).toBeFocused();
		await expect(captcha).toHaveAttribute('aria-invalid', 'true');
		expect(await descriptionAtFocus(page)).toBe(CAPTCHA);
		await captcha.fill('abc123');
		await expect(captcha).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText(CAPTCHA)).toBeHidden();
		expect(sent).toHaveLength(0);
	});

	test('a complete report goes out with what was entered', async ({ page }) => {
		const sent = await openForm(page);
		await page.getByRole('checkbox', { name: 'Current information is correct' }).check();
		await page.getByLabel('How did you verify this?').fill('Visited on Saturday');
		await page.getByLabel(/Bot protection/).fill('abc123');
		await submit(page);

		await expect.poll(() => sent.length).toBe(1);
		expect(sent[0]).toMatchObject({
			type: 'verify-location',
			current: 'Yes',
			outdated: '',
			verified: 'Visited on Saturday',
			captchaSecret: 'test-captcha-secret',
			captchaTest: 'abc123'
		});
		await expect(page.getByRole('link', { name: 'Issue #42' })).toBeVisible();
	});
});
