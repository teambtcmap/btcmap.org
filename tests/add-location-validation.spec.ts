import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, stubReverseGeocode } from './helpers';

// One validation style for every field (#1404): the form runs
// `novalidate` and a rejected Review marks each invalid field inline — an
// error border, aria-invalid, and a message under its label that is the
// field's accessible description before focus lands on the first one. No
// native bubbles, no toasts. Hermetic like the other add-location specs.
const PIN = '/map?add=form#17/42.2762511/42.7024218';

type FocusProbe = { __descAtFocus?: string };

// The theme's `error` colour (#DF3C3C, tailwind.config.js).
const ERROR_RED = 'rgb(223, 60, 60)';

const openForm = async (page: Page) => {
	await stubMapData(page);
	await stubReverseGeocode(page);
	await page.goto(PIN);
	await expect(page.locator('#name')).toBeVisible({
		timeout: MARKER_LOAD_TIMEOUT
	});
	// Let the stubbed lookup land: the suggestion makes the address required.
	await expect(page.locator('#address')).toHaveValue(/Freiheitsstraße/);
};

const fillValid = async (page: Page) => {
	await page.locator('#name').fill('Satoshi Comics');
	await page.locator('#category').selectOption('restaurants');
	await page.locator('#onchain').check();
	await page.locator('#contact').fill('owner@example.com');
};

// Screen readers read a field's description as focus lands, not later
// changes — so record it from the focus event itself.
const recordDescriptionAtFocus = async (field: Locator) => {
	await field.evaluate((el) => {
		el.addEventListener(
			'focus',
			() => {
				(window as unknown as FocusProbe).__descAtFocus = (
					el.getAttribute('aria-describedby') ?? ''
				)
					.split(/\s+/)
					.filter(Boolean)
					.map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
					.join(' ');
			},
			{ once: true }
		);
	});
};

const clickReview = (page: Page) =>
	page.getByRole('button', { name: 'Review & submit' }).click();

// The #1404 contract on the field a rejected Review lands on.
const expectRejectedAt = async (page: Page, field: Locator, message: string) => {
	await expect(field).toBeFocused();
	await expect(field).toHaveAttribute('aria-invalid', 'true');
	await expect(field).toHaveAccessibleDescription(message);
	expect(
		await page.evaluate(() => (window as unknown as FocusProbe).__descAtFocus)
	).toBe(message);
	// Red while focused too: the focus ring mustn't paint over the error
	// border with the link colour.
	await expect(field).toHaveCSS('border-top-color', ERROR_RED);
	await expect(field).toHaveCSS('outline-color', ERROR_RED);
	await expect(page.getByText("Here's what will be published")).toBeHidden();
	// One-shot read: a retrying toHaveCount(0) would wait out an
	// auto-dismissing toast and pass anyway.
	expect(await page.locator('[data-sonner-toast]').count()).toBe(0);
};

test.describe('Add Location — inline validation', () => {
	test.use({ serviceWorkers: 'block' });

	test('an empty or blank name is reported on the field, not by the browser', async ({
		page
	}) => {
		await openForm(page);
		await expect(page.locator('form:has(#name)')).toHaveAttribute('novalidate', '');
		await fillValid(page);

		const name = page.locator('#name');
		await name.fill('');
		await recordDescriptionAtFocus(name);
		await clickReview(page);
		await expectRejectedAt(page, name, "Enter the place's name.");

		// Whitespace alone passed the browser's `required`, only to be
		// rejected by the server after the captcha.
		await name.fill('   ');
		await recordDescriptionAtFocus(name);
		await clickReview(page);
		await expectRejectedAt(page, name, "Enter the place's name.");
	});

	test('a cleared address suggestion is reported on the field', async ({ page }) => {
		await openForm(page);
		await fillValid(page);
		const address = page.locator('#address');
		await address.fill('');
		await recordDescriptionAtFocus(address);
		await clickReview(page);
		await expectRejectedAt(page, address, 'Enter the address.');

		await address.fill('Nansenstr. 1, Berlin');
		await expect(address).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText('Enter the address.')).toBeHidden();
	});

	test('a new suggestion after Move pin takes the address error with it', async ({
		page
	}) => {
		await openForm(page);
		await fillValid(page);
		const address = page.locator('#address');
		await address.fill('');
		await recordDescriptionAtFocus(address);
		await clickReview(page);
		await expectRejectedAt(page, address, 'Enter the address.');

		// Re-place the pin: the panel hides and the whole map drags.
		await page.getByRole('button', { name: 'Move pin' }).click();
		await expect(page.locator('#name')).toBeHidden();
		await page.mouse.move(800, 360);
		await page.mouse.down();
		await page.mouse.move(600, 360, { steps: 10 });
		await page.mouse.up();
		await expect(page).not.toHaveURL(/\/42\.702\d*$/);
		await page.waitForTimeout(600);
		await page.getByRole('button', { name: 'Use this position' }).click();

		// The lookup for the new pin fills the emptied field, which is no
		// longer missing — the message mustn't outlive it.
		await expect(address).toHaveValue(/Freiheitsstraße/);
		await expect(address).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText('Enter the address.')).toBeHidden();
	});

	test('a missing category is reported on the select; picking Other raises nothing new', async ({
		page
	}) => {
		await openForm(page);
		await fillValid(page);
		const category = page.locator('#category');
		await category.selectOption('');
		await recordDescriptionAtFocus(category);
		await clickReview(page);
		await expectRejectedAt(page, category, 'Pick a category.');

		// Other fixes the missing pick. Its text field arrives empty and
		// focused — that's the next step, not an error until the next Review.
		await category.selectOption('Other');
		const other = page.locator('input[name="category-other"]');
		await expect(other).toBeFocused();
		await expect(category).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText('Pick a category.')).toBeHidden();
		// One-shot reads: the field must not arrive flagged at all.
		expect(await page.getByText('Enter a category.').count()).toBe(0);
		expect(await other.getAttribute('aria-invalid')).toBeNull();
	});

	test('an empty Other category is reported inline instead of a toast', async ({
		page
	}) => {
		await openForm(page);
		await fillValid(page);
		await page.locator('#category').selectOption('Other');
		const other = page.locator('input[name="category-other"]');
		// It takes focus on a rejected Review, so it needs a real name —
		// not its "Restaurant etc." placeholder.
		await expect(other).toHaveAccessibleName('Category');
		await other.fill('  ');
		await recordDescriptionAtFocus(other);
		await clickReview(page);
		await expectRejectedAt(page, other, 'Enter a category.');
		// The select itself is fine — only the free text is missing, and the
		// message sits with it: below the select, right above the text field.
		const select = page.locator('#category');
		await expect(select).not.toHaveAttribute('aria-invalid', 'true');
		const selectBox = (await select.boundingBox())!;
		const messageBox = (await page.getByText('Enter a category.').boundingBox())!;
		const otherBox = (await other.boundingBox())!;
		expect(messageBox.y).toBeGreaterThanOrEqual(selectBox.y + selectBox.height);
		expect(messageBox.y + messageBox.height).toBeLessThanOrEqual(otherBox.y);

		await other.fill('Bike repair');
		await expect(page.getByText('Enter a category.')).toBeHidden();
		await expect(other).not.toHaveAttribute('aria-invalid', 'true');
	});

	test('an invalid website is reported even with the details collapsed', async ({
		page
	}) => {
		await openForm(page);
		await fillValid(page);
		const toggle = page.getByRole('button', { name: /Add more details/ });
		await toggle.click();
		const website = page.locator('#website');
		await website.fill('not a site');
		// Collapsed, the field is display:none — the browser couldn't focus
		// it to show its bubble, so Review used to do nothing at all.
		await toggle.click();
		await expect(website).toBeHidden();

		await recordDescriptionAtFocus(website);
		await clickReview(page);
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expectRejectedAt(page, website, 'Enter a web address, like bitcoin.org.');

		// A bare domain is fine: it's published with https:// in front.
		await website.fill('bitcoin.org');
		await expect(page.getByText('Enter a web address, like bitcoin.org.')).toBeHidden();
		await clickReview(page);
		await expect(page.locator('dl')).toContainText('https://bitcoin.org');
	});

	test('the contact email is required and must be valid; a correction in progress stays quiet', async ({
		page
	}) => {
		await openForm(page);
		await fillValid(page);
		const contact = page.locator('#contact');
		await contact.fill('owner@');
		await recordDescriptionAtFocus(contact);
		await clickReview(page);
		await expectRejectedAt(page, contact, 'Enter a valid email address.');

		// Still failing the same rule: the message stays.
		await contact.fill('owner');
		await expect(contact).toHaveAccessibleDescription('Enter a valid email address.');

		// Emptied, a different rule fails. The user is mid-correction, so the
		// field goes quiet instead of swapping messages under their cursor.
		await contact.fill('');
		await expect(contact).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText('Enter a valid email address.')).toBeHidden();
		expect(await page.getByText('Enter an email address.').count()).toBe(0);

		// The next Review reports what's wrong now, and a valid email clears it.
		await recordDescriptionAtFocus(contact);
		await clickReview(page);
		await expectRejectedAt(page, contact, 'Enter an email address.');
		await contact.fill('owner@example.com');
		await expect(contact).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText('Enter an email address.')).toBeHidden();
	});

	test('every invalid field is marked at once and the first one takes focus', async ({
		page
	}) => {
		await openForm(page);
		const name = page.locator('#name');
		await recordDescriptionAtFocus(name);
		await clickReview(page);
		await expectRejectedAt(page, name, "Enter the place's name.");
		for (const message of [
			'Pick a category.',
			'Pick at least one to continue.',
			'Enter an email address.'
		]) {
			await expect(page.getByText(message)).toBeVisible();
		}

		// Correcting one field clears only its own error.
		await name.fill('Satoshi Comics');
		await expect(page.getByText("Enter the place's name.")).toBeHidden();
		await expect(page.getByText('Pick a category.')).toBeVisible();
		await expect(page.getByText('Enter an email address.')).toBeVisible();
	});

	test('the focused field lands with its label and message clear of the sticky header', async ({
		page
	}) => {
		await openForm(page);
		await fillValid(page);
		await page.locator('#name').fill('');
		// Review sits at the bottom of the form; the rejected name is at the
		// top, so focusing it has to scroll the panel back up.
		await clickReview(page);
		await expect(page.locator('#name')).toBeFocused();

		const panel = page.getByRole('region', { name: 'Add Location' });
		const header = panel.locator('div.sticky').first();
		const label = page.locator('label[for="name"]');
		await expect
			.poll(async () => {
				const labelBox = await label.boundingBox();
				const headerBox = await header.boundingBox();
				return labelBox!.y - (headerBox!.y + headerBox!.height);
			})
			.toBeGreaterThanOrEqual(0);
		await expect(page.getByText("Enter the place's name.")).toBeInViewport();
	});

	test('a missing captcha answer is reported on the field, and nothing is sent', async ({
		page
	}) => {
		await page.route('**/captcha', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					captcha:
						'<svg xmlns="http://www.w3.org/2000/svg" width="275" height="100"></svg>',
					captchaSecret: 'test-captcha-secret'
				})
			});
		});
		let submits = 0;
		await page.route('**/api/submit-place', async (route) => {
			submits++;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ id: 321 })
			});
		});
		await openForm(page);
		await fillValid(page);
		await clickReview(page);
		await expect(page.getByText("Here's what will be published")).toBeVisible();

		// The label reads its hint once: the strings used to carry their own
		// parentheses inside the template's.
		await expect(page.locator('label[for="captcha"]')).toHaveText(
			'Bot protection (case-sensitive)'
		);

		const captcha = page.locator('#captcha');
		await expect(captcha).toBeEnabled();
		await recordDescriptionAtFocus(captcha);
		await page.getByRole('button', { name: 'Submit Location' }).click();
		await expect(captcha).toBeFocused();
		await expect(captcha).toHaveAttribute('aria-invalid', 'true');
		await expect(captcha).toHaveAccessibleDescription(
			'Enter the characters from the image.'
		);
		await expect(captcha).toHaveCSS('border-top-color', ERROR_RED);
		await expect(captcha).toHaveCSS('outline-color', ERROR_RED);
		expect(
			await page.evaluate(() => (window as unknown as FocusProbe).__descAtFocus)
		).toBe('Enter the characters from the image.');
		expect(await page.locator('[data-sonner-toast]').count()).toBe(0);
		expect(submits).toBe(0);

		await captcha.fill('abc123');
		await expect(captcha).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText('Enter the characters from the image.')).toBeHidden();
	});
});
