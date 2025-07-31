import { test, expect } from '@playwright/test';

test.describe('Verify Location Page', () => {
	test('loads merchant data and shows functional form', async ({ page }) => {
		// Navigate to verify-location with a valid merchant ID
		await page.goto('http://127.0.0.1:5173/verify-location?id=node:9135176628');

		// Wait for page to load
		await page.waitForLoadState('domcontentloaded');

		// Check page title
		await expect(page).toHaveTitle(/BTC Map - Verify Location/);

		// Check main heading is visible
		const heading = page.getByRole('heading', { name: 'Verify Location' });
		await expect(heading).toBeVisible();

		// Check that merchant name loads correctly (may take a moment for server data)
		const merchantNameInput = page.getByPlaceholder(/Merchant Name/);
		await expect(merchantNameInput).toBeVisible();

		// Verify form elements are present
		await expect(page.getByText('Current information is correct')).toBeVisible();
		await expect(page.getByText('Outdated information')).toBeVisible();
		await expect(page.getByText('How did you verify this?')).toBeVisible();
		await expect(page.getByText('Bot protection')).toBeVisible();

		// Check submit button is present
		const submitButton = page.getByRole('button', { name: 'Submit Report' });
		await expect(submitButton).toBeVisible();

		// Wait for merchant data to load first (indicates API call succeeded)
		await expect(merchantNameInput).toHaveValue('Bitstop at Olive Mart Valero', { timeout: 30000 });

		// Simple approach: just wait for form to be enabled with a generous timeout
		const currentCheckbox = page.getByRole('checkbox', { name: 'Current information is correct' });
		await expect(currentCheckbox).toBeEnabled({ timeout: 45000 });

		const verifyTextarea = page.getByPlaceholder('Please provide additional info here');
		await expect(verifyTextarea).toBeEnabled({ timeout: 10000 });
	});

	test('shows error for missing ID parameter', async ({ page }) => {
		// Navigate to verify-location without ID parameter
		await page.goto('http://127.0.0.1:5173/verify-location');

		// Should get a 400 error page for missing ID
		await expect(page.getByText('400')).toBeVisible();
		await expect(page.getByText('Merchant ID parameter is required')).toBeVisible();
	});

	test('shows error for invalid merchant ID', async ({ page }) => {
		// Navigate to verify-location with invalid ID
		await page.goto('http://127.0.0.1:5173/verify-location?id=invalid-id-123');

		// Should get a 404 error page for invalid merchant
		await expect(page.getByText('404')).toBeVisible();
		await expect(page.getByText('Merchant Not Found')).toBeVisible();
	});
});
