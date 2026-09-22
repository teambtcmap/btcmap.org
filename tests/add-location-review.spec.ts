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

	test('a failed submit hands the retry a fresh captcha', async ({ page }) => {
		// The server burns a captcha on its first correct answer, before the
		// submission itself can fail (#1401) — so a retry must never resend
		// that secret. Each fetch mints a distinct one to tell them apart.
		let captchaFetches = 0;
		await page.route('**/captcha', async (route) => {
			captchaFetches++;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					captcha:
						'<svg xmlns="http://www.w3.org/2000/svg" width="275" height="100"></svg>',
					captchaSecret: `test-captcha-secret-${captchaFetches}`
				})
			});
		});
		await openAndFillForm(page);

		const sentSecrets: string[] = [];
		await page.route('**/api/submit-place', async (route) => {
			sentSecrets.push(route.request().postDataJSON().captchaSecret);
			// First attempt: the upstream pipeline fails after the captcha
			// check; the retry goes through.
			await route.fulfill(
				sentSecrets.length === 1
					? {
							status: 502,
							contentType: 'application/json',
							body: JSON.stringify({
								message: 'Could not submit the location, please try again later.'
							})
						}
					: {
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({ id: 321 })
						}
			);
		});

		await page.getByRole('button', { name: 'Review & submit' }).click();
		await expect(page.getByText("Here's what will be published")).toBeVisible();
		await page.locator('#captcha').fill('abc123');
		await page.getByRole('button', { name: 'Submit Location' }).click();

		// The failure replaces the captcha and clears the stale answer.
		await expect.poll(() => captchaFetches).toBe(2);
		await expect(page.locator('#captcha')).toHaveValue('');

		await page.locator('#captcha').fill('xyz789');
		await page.getByRole('button', { name: 'Submit Location' }).click();
		await expect(page.getByText('Volunteer review')).toBeVisible();
		expect(sentSecrets).toEqual([
			'test-captcha-secret-1',
			'test-captcha-secret-2'
		]);
	});

	test('review shows what will be published and round-trips to edit', async ({
		page
	}) => {
		// The captcha never answers in this test — proving the edit step
		// (fields, filling, entering review) does not depend on it. Before
		// #1341 every input sat disabled behind this fetch.
		await page.route('**/captcha', () => new Promise<void>(() => {}));
		await openAndFillForm(page);

		// Progress lives in the panel header (#1394).
		const panel = page.getByRole('region', { name: 'Add Location' });
		await expect(panel.getByText('Step 1 of 2 · Details')).toBeVisible();

		await page.getByRole('button', { name: 'Review & submit' }).click();

		// The summary replaces the fields; the captcha lives here now.
		await expect(page.getByText("Here's what will be published")).toBeVisible();
		await expect(panel.getByText('Step 2 of 2 · Review')).toBeVisible();
		// Entering review scrolls the form's top clear of the (now taller)
		// sticky header, so the back link is visible, not tucked under it.
		const back = page.getByRole('button', { name: 'Back to details' });
		const header = panel.locator('div.sticky').first();
		await expect
			.poll(async () => {
				const backBox = await back.boundingBox();
				const headerBox = await header.boundingBox();
				return backBox!.y - (headerBox!.y + headerBox!.height);
			})
			.toBeGreaterThanOrEqual(0);
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

		// Back sits at the top of the review step, above the summary — not
		// below the captcha — and the old bottom button is gone.
		const backBox = await back.boundingBox();
		const summaryBox = await summary.boundingBox();
		expect(backBox!.y).toBeLessThan(summaryBox!.y);
		expect(
			await page.getByRole('button', { name: 'Edit details' }).count()
		).toBe(0);

		// Back to edit: the hidden-not-unmounted fields kept their values.
		await back.click();
		await expect(panel.getByText('Step 1 of 2 · Details')).toBeVisible();
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

		// Pan the map while the summary is up — on desktop it stays
		// pannable beside the panel. The submission must keep the pin
		// frozen since the form opened, not the panned centre (a 400px pan
		// at z17 shifts the longitude ~0.002–0.004°, past the tolerance).
		await page.mouse.move(900, 360);
		await page.mouse.down();
		await page.mouse.move(500, 360, { steps: 10 });
		await page.mouse.up();
		// Let moveend settle (a live pin would have moved by now), and
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

		// The title names the place; the honest three-step track (#1342)
		// keeps its stages, but only the current one explains itself (#1395).
		await expect(
			page.getByRole('heading', { name: 'Satoshi Comics is submitted' })
		).toBeVisible();
		await expect(page.getByText('Waiting for review')).toBeVisible();
		const track = page.getByRole('list').filter({ hasText: 'Volunteer review' });
		await expect(track.getByRole('listitem')).toHaveCount(3);
		const current = track.locator('[aria-current="step"]');
		await expect(current).toContainText('Volunteer review');
		await expect(current).toContainText('Typically 1–2 days');
		await expect(
			current.getByRole('link', { name: 'Follow the public review queue' })
		).toBeVisible();
		// Past and future stages are a label and a dot (one-shot reads —
		// the screen renders at once).
		expect(await page.getByText('Received just now').count()).toBe(0);
		expect(await page.getByText('On BTC Map and OpenStreetMap').count()).toBe(0);
		// No step counter here: "step N of 2" belongs to the form.
		expect(await page.getByText(/Step \d of 2/).count()).toBe(0);

		// One ask, chosen by state: anonymous → the account nudge, below
		// the actions; no tagger line competing with it.
		const ask = page.getByText('Keep a record of what you add');
		await expect(ask).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Create an account' })
		).toHaveAttribute('href', '/signup');
		expect(
			await page
				.getByRole('link', { name: 'Learn how volunteers maintain the map' })
				.count()
		).toBe(0);
		const addAnotherBox = await page
			.getByRole('button', { name: 'Submit another Location' })
			.boundingBox();
		const askBox = await ask.boundingBox();
		expect(askBox!.y).toBeGreaterThan(addAnotherBox!.y);
	});

	test('signed in: no captcha, direct API submission, attributed success', async ({
		page
	}) => {
		// Seeded before any app script runs — session.init() hydrates from
		// localStorage in onMount.
		await page.addInitScript(() => {
			localStorage.setItem(
				'btcmap_session',
				JSON.stringify({
					username: 'satoshi',
					password: '',
					token: 'test-token',
					savedPlaces: [],
					savedAreas: [],
					autoGenerated: false,
					npub: null
				})
			);
		});
		await stubMapData(page);
		await stubReverseGeocode(page);
		// The authorized path (#1374) goes straight to the REST API. Registered
		// AFTER stubMapData on purpose: Playwright matches routes in reverse
		// registration order and stubMapData's catch-all also covers /v4/, so
		// registering this first would let the catch-all answer the POST with
		// [] instead of this body.
		await page.route('**/v4/place-submissions', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ id: 55, origin: 'user' })
			});
		});
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});
		await page.locator('#name').fill('Satoshi Comics');
		await expect(page.locator('#address')).toHaveValue(/Freiheitsstraße/);
		await page.locator('#category').selectOption('restaurants');
		await page.locator('#onchain').check();
		// The account is the identity — no contact field to fill.
		await expect(page.locator('#contact')).toHaveCount(0);

		await page.getByRole('button', { name: 'Review & submit' }).click();
		await expect(page.getByText("Here's what will be published")).toBeVisible();
		// No captcha for the authorized path — the token is the bot check.
		await expect(page.locator('#captcha')).toHaveCount(0);
		await expect(page.locator('dl')).toContainText('satoshi');

		const [submitRequest] = await Promise.all([
			page.waitForRequest(
				(req) =>
					req.url().includes('/v4/place-submissions') &&
					req.method() === 'POST'
			),
			page.getByRole('button', { name: 'Submit Location' }).click()
		]);

		expect(submitRequest.headers().authorization).toBe('Bearer test-token');
		const body = submitRequest.postDataJSON();
		expect(body).toMatchObject({
			name: 'Satoshi Comics',
			category: 'restaurants'
		});
		// The API speaks lon; extra_fields are place fields — no submitter
		// identity or contact in them.
		expect(body.lon).toBeCloseTo(42.702, 2);
		expect(body.lat).toBeCloseTo(42.276, 2);
		expect(body.extra_fields.payment_methods).toBe('onchain');
		expect('contact' in body.extra_fields).toBe(false);
		expect('submitted_by' in body.extra_fields).toBe(false);

		// Attributed success: the same slot carries the tagger invitation
		// (#1368) instead of the account nudge.
		await expect(page.getByText('Waiting for review')).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Learn how volunteers maintain the map' })
		).toHaveAttribute('href', '/join-us');
		expect(await page.getByText('Keep a record of what you add').count()).toBe(0);
	});
});
