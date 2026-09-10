import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, stubReverseGeocode } from './helpers';

// The review step (#1341) and the honest success track (#1342): the form
// is usable without waiting on the captcha, "here's what will be
// published" gets one explicit look (captcha included), and the success
// screen shows the truthful three-step status. Hermetic — map data,
// reverse geocode, captcha and the submit endpoint are all stubbed; the
// SW block lets page.route see the same-origin calls.
const PIN = '/map?add=form#17/42.2762511/42.7024218';

const stubCaptcha = async (page: Page) => {
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
};

const openAndFillForm = async (page: Page) => {
	await stubMapData(page);
	await stubReverseGeocode(page);
	await page.goto(PIN);
	await expect(page.locator('#name')).toBeVisible({
		timeout: MARKER_LOAD_TIMEOUT
	});
	// No captcha gate anymore — the fields are usable immediately (#1341).
	await expect(page.locator('#name')).toBeEnabled();
	await page.locator('#name').fill('Satoshi Comics');
	// The stubbed reverse geocode prefills the address.
	await expect(page.locator('#address')).toHaveValue(/Freiheitsstraße/);
	await page.locator('#category').selectOption('restaurants');
	await page.locator('#onchain').check();
	await page.locator('#contact').fill('owner@example.com');
};

test.describe('Add Location — review step', () => {
	test.use({ serviceWorkers: 'block' });

	test('review shows what will be published and round-trips to edit', async ({
		page
	}) => {
		// The captcha never answers in this test — proving the edit step
		// (fields, filling, entering review) does not depend on it. Before
		// #1341 every input sat disabled behind this fetch.
		await page.route('**/captcha', () => new Promise<void>(() => {}));
		await openAndFillForm(page);

		await page.getByRole('button', { name: 'Review & submit' }).click();

		// The summary replaces the fields; the captcha lives here now.
		await expect(page.getByText("Here's what will be published")).toBeVisible();
		await expect(page.locator('#name')).toBeHidden();
		const summary = page.locator('dl');
		await expect(summary).toContainText('Satoshi Comics');
		await expect(summary).toContainText('Freiheitsstraße');
		await expect(summary).toContainText('On-chain');
		// The frozen pin position is part of what's published (#1341).
		await expect(summary).toContainText('42.27');
		await expect(summary).toContainText('owner@example.com');
		// No account attached — the ticket will say so.
		await expect(summary).toContainText('Anonymous');
		// Empty optionals leave no rows behind.
		await expect(summary).not.toContainText('Website');
		await expect(page.locator('#captcha')).toBeVisible();

		// Back to edit: the hidden-not-unmounted fields kept their values.
		await page.getByRole('button', { name: 'Edit details' }).click();
		await expect(page.locator('#name')).toBeVisible();
		await expect(page.locator('#name')).toHaveValue('Satoshi Comics');
		await expect(
			page.getByText("Here's what will be published")
		).toBeHidden();
	});

	test('confirm submits the reviewed data and lands on the honest track', async ({
		page
	}) => {
		await stubCaptcha(page);
		await openAndFillForm(page);

		await page.route('**/api/submit-place', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ id: 321, attributed: false })
			});
		});

		await page.getByRole('button', { name: 'Review & submit' }).click();
		await expect(page.getByText("Here's what will be published")).toBeVisible();

		// Pan the map while the summary is up — on desktop it stays live
		// beside the panel. The submission must keep the coords frozen at
		// review entry, not the moved pin (a 400px pan at z17 shifts the
		// longitude ~0.004°, well past the assertion tolerance below).
		await page.mouse.move(900, 360);
		await page.mouse.down();
		await page.mouse.move(500, 360, { steps: 10 });
		await page.mouse.up();
		// Let moveend settle so the host refreshes its live coords, and
		// prove the pan registered (the map rewrites the hash on moveend) —
		// otherwise the frozen-coords assertion below would be vacuous.
		await page.waitForTimeout(600);
		await expect(page).not.toHaveURL(/42\.7024/);

		await page.locator('#captcha').fill('abc123');

		const [submitRequest] = await Promise.all([
			page.waitForRequest(
				(req) =>
					req.url().includes('/api/submit-place') && req.method() === 'POST'
			),
			page.getByRole('button', { name: 'Submit Location' }).click()
		]);

		// The payload is the reviewed snapshot plus the captcha answer.
		const body = submitRequest.postDataJSON();
		expect(body).toMatchObject({
			name: 'Satoshi Comics',
			category: 'restaurants',
			methods: ['onchain'],
			contact: 'owner@example.com',
			captchaSecret: 'test-captcha-secret',
			captchaTest: 'abc123'
		});
		// The coords frozen at review entry — the hash pin, NOT the panned
		// map (toBeCloseTo precision 3 = ±0.0005°, the pan moved ~0.004°).
		expect(body.lat).toBeCloseTo(42.27625, 3);
		expect(body.long).toBeCloseTo(42.70242, 3);

		// The honest three-step status track (#1342) — no notification
		// promises, and the anonymous submission still gets the account
		// nudge.
		await expect(page.getByText('Received just now')).toBeVisible();
		await expect(page.getByText('Volunteer review')).toBeVisible();
		await expect(page.getByText('Live on the map')).toBeVisible();
		await expect(page.getByText(/Planning to add more places/)).toBeVisible();
		// The tagger-guide recruit line (#1368) answers the question the
		// track's second step raises.
		await expect(
			page.getByRole('link', { name: 'Learn how volunteers maintain the map' })
		).toHaveAttribute('href', 'https://join.btcmap.org/');
	});
});
