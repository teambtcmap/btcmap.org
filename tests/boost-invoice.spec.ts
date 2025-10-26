import { test, expect } from '@playwright/test';

test.describe('Boost Invoice Generation', () => {
	test('clicking boost button generates a valid invoice', async ({ page }) => {
		// Mock the exchange rate API with wildcard pattern
		await page.route('**/blockchain.info/**', async (route) => {
			console.log('Exchange rate API intercepted:', route.request().url());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					USD: { '15m': 65000, last: 65000, buy: 65000, sell: 65000, symbol: '$' }
				})
			});
		});

		// Navigate to a known merchant detail page (Green Town, ID 23143)
		await page.goto('http://127.0.0.1:5173/merchant/23143', { waitUntil: 'load' });
		await expect(page).toHaveTitle(/BTC Map/);

		// Wait for merchant data to load - check for specific content that only appears with data
		await expect(page.getByRole('heading', { name: 'Green Town', exact: true })).toBeVisible({
			timeout: 10000
		});

		// Wait for the "Last Surveyed" card which indicates data is loaded
		await expect(page.getByText('Last Surveyed')).toBeVisible({ timeout: 10000 });

		// Wait for the boost button to appear
		const boostButton = page.locator('#boost-button');
		await expect(boostButton).toBeVisible({ timeout: 10000 });

		// Wait a bit more to ensure merchant data prop is set
		await page.waitForTimeout(1000);

		// Click the boost button to trigger exchange rate fetch
		await boostButton.click();

		// Wait for boost modal to appear after exchange rate loads
		const boostModal = page.locator('text=Boost Location');
		await expect(boostModal).toBeVisible({ timeout: 10000 });

		// Wait for exchange rate to load (buttons should become enabled)
		await page.waitForTimeout(2000);

		// Select the first boost option (1 month / 30 days)
		const firstBoostOption = page.locator('button').filter({ hasText: /\$5/ }).first();
		await expect(firstBoostOption).toBeVisible();
		await firstBoostOption.click();

		// The button text should update to show the selected duration
		const boostConfirmButton = page.locator('button', { hasText: /Boost for 1 month/ });
		await expect(boostConfirmButton).toBeVisible();

		// Set up request interception to capture the API call
		const invoiceRequestPromise = page.waitForRequest(
			(request) =>
				request.url().includes('/api/boost/invoice/generate') && request.method() === 'POST',
			{ timeout: 10000 }
		);

		// Set up response interception to verify the invoice
		const invoiceResponsePromise = page.waitForResponse(
			(response) =>
				response.url().includes('/api/boost/invoice/generate') && response.status() === 200,
			{ timeout: 10000 }
		);

		// Click to generate invoice
		await boostConfirmButton.click();

		// Wait for the request and response
		const invoiceRequest = await invoiceRequestPromise;
		const invoiceResponse = await invoiceResponsePromise;

		// Verify the request payload contains correct parameters
		const requestBody = invoiceRequest.postDataJSON();
		expect(requestBody).toHaveProperty('place_id', 23143);
		expect(requestBody).toHaveProperty('days', 30);
		expect(requestBody).not.toHaveProperty('amount'); // Should not send amount
		expect(requestBody).not.toHaveProperty('name'); // Should not send name

		// Verify the response contains a valid invoice
		const responseBody = await invoiceResponse.json();
		expect(responseBody).toHaveProperty('invoice');
		expect(responseBody).toHaveProperty('invoice_id');

		// Invoice should be a Lightning BOLT-11 invoice (starts with lnbc)
		expect(responseBody.invoice).toMatch(/^lnbc/);

		// Invoice ID should be a valid UUID
		expect(responseBody.invoice_id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		);

		// Verify the UI updates to show the invoice
		await expect(page.locator('text=Scan or click to pay with lightning')).toBeVisible({
			timeout: 5000
		});

		// QR code should be visible
		const qrCode = page.locator('canvas').first();
		await expect(qrCode).toBeVisible();

		console.log('✓ Successfully generated invoice:', responseBody.invoice_id);
	});

	test('boost invoice API validates required parameters', async ({ page }) => {
		// Test that the API properly validates missing/invalid parameters
		const response = await page.request.post('http://127.0.0.1:5173/api/boost/invoice/generate', {
			data: {
				place_id: 23143
				// Missing 'days' parameter
			}
		});

		expect(response.status()).toBe(400);
		const responseBody = await response.json();
		expect(responseBody.message).toContain('Missing required parameters');
	});

	test('boost invoice API validates days parameter', async ({ page }) => {
		const response = await page.request.post('http://127.0.0.1:5173/api/boost/invoice/generate', {
			data: {
				place_id: 23143,
				days: -1 // Invalid days value
			}
		});

		expect(response.status()).toBe(400);
		const responseBody = await response.json();
		expect(responseBody.message).toContain('Invalid days parameter');
	});
});
