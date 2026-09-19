import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
	descriptionAtFocus,
	ERROR_RED,
	recordDescriptionAtFocus,
	stubCaptcha
} from './helpers';

// /communities/add reports invalid input inline (#1409), the #1404 way:
// `novalidate`, a message under the label that is the field's accessible
// description before focus lands, an error border, no native bubbles and
// no toasts. Hermetic: the captcha, the Nominatim area search and the
// submission are stubbed, so nothing reaches Gitea.
const PAGE = '/communities/add';
const LOCATION = 'Search for your area and pick it from the results.';
const NAME = "Enter the community's name.";
const ICON = 'Enter a full web address for the icon, starting with https://.';
const SOCIALS = 'Add at least one way for people to join.';
const CONTACT = 'Enter a way to reach you.';
const CAPTCHA = 'Enter the characters from the image.';

type SubmitProbe = { __formEvents?: string[] };

const openForm = async (page: Page) => {
	await stubCaptcha(page);
	await page.route(
		(u) => u.hostname === 'nominatim.openstreetmap.org' && u.pathname === '/search',
		(route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						display_name: 'Sofia, Bulgaria',
						geojson: { type: 'Polygon', coordinates: [] }
					}
				])
			})
	);
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
	// The fields unlock once the captcha is in.
	await expect(page.getByLabel('Community Name')).toBeEnabled({ timeout: 15000 });
	return sent;
};

const submit = (page: Page) =>
	page.getByRole('button', { name: 'Submit Community' }).click();

const pickLocation = async (page: Page) => {
	await page.getByLabel('Select Location').fill('Sofia');
	await page.getByRole('button', { name: 'Search 🔍' }).click();
	await page.getByRole('button', { name: 'Sofia, Bulgaria' }).click();
};

const fillValid = async (page: Page) => {
	await pickLocation(page);
	await page.getByLabel('Community Name').fill('Bitcoin Sofia');
	await page.getByLabel('Social Links').fill('https://t.me/bitcoinsofia');
	await page.getByLabel('Public Contact').fill('hello@example.com');
	await page.getByLabel(/Bot protection/).fill('abc123');
};

test.describe('Add Community — inline validation', () => {
	// The service worker would answer /captcha before page.route saw it.
	test.use({ serviceWorkers: 'block' });

	test('an empty form is marked field by field, not by the browser', async ({ page }) => {
		const sent = await openForm(page);
		await expect(page.locator('#add-community form')).toHaveAttribute('novalidate', '');
		// Each label names its own field (contact's pointed at the icon), and
		// the optional tag reads once, not "((optional))".
		await expect(page.getByLabel('Public Contact')).toHaveAttribute('name', 'contact');
		await expect(page.locator('label[for="icon"]')).toHaveText('Icon URL (optional)');
		// A URL field, for the keyboard and autofill (the form is novalidate).
		await expect(page.getByLabel('Icon URL')).toHaveAttribute('type', 'url');

		const search = page.getByLabel('Select Location');
		await recordDescriptionAtFocus(search);
		await submit(page);

		await expect(search).toBeFocused();
		await expect(search).toHaveAttribute('aria-invalid', 'true');
		await expect(search).toHaveAccessibleDescription(LOCATION);
		expect(await descriptionAtFocus(page)).toBe(LOCATION);
		await expect(search).toHaveCSS('border-top-color', ERROR_RED);
		await expect(search).toHaveCSS('outline-color', ERROR_RED);

		for (const [label, message] of [
			['Community Name', NAME],
			['Social Links', SOCIALS],
			['Public Contact', CONTACT]
		] as const) {
			const field = page.getByLabel(label);
			await expect(field).toHaveAttribute('aria-invalid', 'true');
			await expect(field).toHaveAccessibleDescription(message);
		}
		await expect(page.getByLabel(/Bot protection/)).toHaveAccessibleDescription(CAPTCHA);

		// One-shot reads: a retrying check would wait out a toast.
		expect(await page.locator('[data-sonner-toast]').count()).toBe(0);
		expect(sent).toHaveLength(0);
	});

	test('searching and picking an area never submit the form', async ({ page }) => {
		await openForm(page);
		// Enter in the search and a click on a result both used to reach the
		// form: a submit, or the browser's validation of every other field.
		await page.locator('#add-community form').evaluate((form) => {
			const events: string[] = [];
			(window as unknown as SubmitProbe).__formEvents = events;
			form.addEventListener('submit', () => events.push('submit'), true);
			form.addEventListener('invalid', () => events.push('invalid'), true);
		});

		const search = page.getByLabel('Select Location');
		await search.fill('Sofia');
		await search.press('Enter');
		const result = page.getByRole('button', { name: 'Sofia, Bulgaria' });
		await expect(result).toBeVisible();
		await result.click();
		await expect(page.getByText('Location selected!').first()).toBeVisible();

		expect(
			await page.evaluate(() => (window as unknown as SubmitProbe).__formEvents)
		).toEqual([]);
		expect(await page.getByText(NAME).count()).toBe(0);
	});

	test('picking an area clears the location error', async ({ page }) => {
		await openForm(page);
		await submit(page);
		const search = page.getByLabel('Select Location');
		await expect(search).toHaveAccessibleDescription(LOCATION);

		await pickLocation(page);
		await expect(search).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText(LOCATION)).toBeHidden();
	});

	test('an icon has to be a full web address', async ({ page }) => {
		const sent = await openForm(page);
		await fillValid(page);
		const icon = page.getByLabel('Icon URL');
		await icon.fill('icon.png');
		await recordDescriptionAtFocus(icon);
		await submit(page);

		await expect(icon).toBeFocused();
		await expect(icon).toHaveAttribute('aria-invalid', 'true');
		expect(await descriptionAtFocus(page)).toBe(ICON);
		await icon.fill('https://example.com/icon.png');
		await expect(icon).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText(ICON)).toBeHidden();
		expect(sent).toHaveLength(0);
	});

	test('a complete application goes out with what was entered', async ({ page }) => {
		const sent = await openForm(page);
		await fillValid(page);
		await page.getByLabel('Icon URL').fill('https://example.com/icon.png');
		await submit(page);

		await expect.poll(() => sent.length).toBe(1);
		expect(sent[0]).toMatchObject({
			type: 'community',
			location: 'Sofia, Bulgaria',
			name: 'Bitcoin Sofia',
			icon: 'https://example.com/icon.png',
			socialLinks: 'https://t.me/bitcoinsofia',
			contact: 'hello@example.com',
			captchaSecret: 'test-captcha-secret',
			captchaTest: 'abc123'
		});
		await expect(page.getByRole('link', { name: 'Issue #42' })).toBeVisible();
	});
});
