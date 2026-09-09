import { expect, test } from '@playwright/test';

import { mockBoostInvoiceAPI } from './helpers';

const MERCHANT_ID = 23143;
const API_ENDPOINT = '/v4/place-boosts';

test.describe('Boost Invoice Generation', () => {
	// The invoice call goes straight to api.btcmap.org (#1348) — blocking
	// the service worker lets page.route intercept the cross-origin POST.
	test.use({ serviceWorkers: 'block' });
	test('generates valid invoice through complete UI flow', async ({ page }) => {
		// Mock boost invoice API to prevent real invoice creation during test execution
		await mockBoostInvoiceAPI(page);

		// Mock exchange rate API to avoid external dependency
		await page.route('**/blockchain.info/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					USD: { '15m': 65000 }
				})
			});
		});

		// Navigate to merchant detail page
		await page.goto(`/merchant/${MERCHANT_ID}`);
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for merchant data to load completely
		await expect(page.getByRole('heading', { name: 'Green Town', exact: true })).toBeVisible();
		await expect(page.getByText('Verify Location')).toBeVisible();

		// Wait for boost button to be interactive
		const boostButton = page.locator('#boost-button');
		await expect(boostButton).toBeVisible();
		await expect(boostButton).toBeEnabled();

		// Click boost button and wait for modal
		await boostButton.click();
		await expect(page.locator('text=Boost Location')).toBeVisible({ timeout: 10000 });

		// Select first boost option (30 days / $5)
		const boostOption = page.locator('button').filter({ hasText: '5,000 sats' }).first();
		await expect(boostOption).toBeVisible();
		await boostOption.click({ force: true });

		// Wait for confirm button and set up API interception
		const confirmButton = page.locator('button', { hasText: /Boost for 1 month/ });
		await expect(confirmButton).toBeVisible();

		const [invoiceRequest, invoiceResponse] = await Promise.all([
			page.waitForRequest((req) => req.url().includes(API_ENDPOINT) && req.method() === 'POST', {
				timeout: 10000
			}),
			page.waitForResponse((res) => res.url().includes(API_ENDPOINT) && res.status() === 200, {
				timeout: 10000
			}),
			confirmButton.click()
		]);

		// Verify request payload
		const requestBody = invoiceRequest.postDataJSON();
		// The API takes the id as a string (#1348).
		expect(requestBody).toEqual({
			place_id: String(MERCHANT_ID),
			days: 30
		});

		// Verify response structure
		const responseBody = await invoiceResponse.json();
		expect(responseBody).toMatchObject({
			invoice: expect.stringMatching(/^lnbc/),
			invoice_id: expect.stringMatching(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			)
		});

		// Verify UI updates
		await expect(page.locator('text=Scan or click to pay with lightning')).toBeVisible();
		await expect(page.locator('canvas').first()).toBeVisible();
	});


});
