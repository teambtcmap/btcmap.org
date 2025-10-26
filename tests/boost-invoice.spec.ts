import { test, expect } from '@playwright/test';

const MERCHANT_ID = 23143;
const BASE_URL = 'http://127.0.0.1:5173';
const API_ENDPOINT = '/api/boost/invoice/generate';

test.describe('Boost Invoice Generation', () => {
	test('generates valid invoice through complete UI flow', async ({ page }) => {
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
		await page.goto(`${BASE_URL}/merchant/${MERCHANT_ID}`);
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for merchant data to load completely
		await expect(page.getByRole('heading', { name: 'Green Town', exact: true })).toBeVisible();
		await expect(page.getByText('Last Surveyed')).toBeVisible();

		// Wait for boost button and ensure merchant data prop is available
		const boostButton = page.locator('#boost-button');
		await expect(boostButton).toBeVisible();
		await page.waitForTimeout(1000);

		// Click boost button and wait for modal
		await boostButton.click();
		await expect(page.locator('text=Boost Location')).toBeVisible({ timeout: 10000 });

		// Wait for modal animation to complete
		await page.waitForTimeout(500);

		// Select first boost option (30 days / $5)
		const boostOption = page.locator('button').filter({ hasText: /\$5/ }).first();
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
		expect(requestBody).toEqual({
			place_id: MERCHANT_ID,
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

	test('validates missing required parameters', async ({ page }) => {
		const response = await page.request.post(`${BASE_URL}${API_ENDPOINT}`, {
			data: { place_id: MERCHANT_ID }
		});

		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.message).toContain('Missing required parameters');
	});

	test('validates invalid days parameter', async ({ page }) => {
		const response = await page.request.post(`${BASE_URL}${API_ENDPOINT}`, {
			data: {
				place_id: MERCHANT_ID,
				days: -1
			}
		});

		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.message).toContain('Invalid days parameter');
	});
});
