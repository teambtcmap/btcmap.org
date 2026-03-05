import { test, expect } from '@playwright/test';
import { setupConsoleErrorCollection, checkForConsoleErrors } from './helpers';

// Known deleted merchant — "Tabaccheria Il Quadrifoglio" (deleted 2023-04-20)
const DELETED_MERCHANT_ID = 7361;

test.describe('Deleted Merchant Page', () => {
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	test('renders deleted merchant detail view instead of 500', async ({ page }) => {
		const response = await page.goto(`/merchant/${DELETED_MERCHANT_ID}`);

		// Must not be a server error
		expect(response?.status()).toBe(200);
	});

	test('shows deleted notice banner', async ({ page }) => {
		await page.goto(`/merchant/${DELETED_MERCHANT_ID}`);

		await expect(
			page.getByText('This merchant has been removed from BTC Map')
		).toBeVisible();

		await expect(
			page.getByText('outdated and for reference only')
		).toBeVisible();
	});

	test('displays merchant name with Deleted suffix', async ({ page }) => {
		await page.goto(`/merchant/${DELETED_MERCHANT_ID}`);

		await expect(
			page.getByRole('heading', { name: /Tabaccheria Il Quadrifoglio.*Deleted/i })
		).toBeVisible();
	});

	test('renders map for deleted merchant', async ({ page }) => {
		await page.goto(`/merchant/${DELETED_MERCHANT_ID}`);

		// Map container should still render for deleted merchants
		await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
	});
});
