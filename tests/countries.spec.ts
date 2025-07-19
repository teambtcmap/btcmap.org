import { test, expect } from '@playwright/test';

test.describe('Countries', () => {
	test('redirects to Africa section by default', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/countries');

		// Should redirect to /countries/africa
		await expect(page).toHaveURL(/countries\/africa/);

		// Wait for the page to load
		const heading = page.getByRole('heading', {
			name: 'Bitcoin adoption by countries.'
		});
		await heading.waitFor({ state: 'visible' });
		await expect(heading).toBeVisible();

		// Check that Africa section is shown by default
		const africaHeading = page.getByRole('heading', { name: 'Africa' });
		await africaHeading.waitFor({ state: 'visible' });
		await expect(africaHeading).toBeVisible();

		// Verify dropdown shows Africa selected
		const dropdown = page.getByRole('combobox');
		await expect(dropdown).toHaveValue('africa');
	});

	test('navigates to different continent sections via route parameters', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/countries/europe');

		// Check that the URL is correct
		await expect(page).toHaveURL(/countries\/europe/);

		// Wait for the page to load
		const heading = page.getByRole('heading', {
			name: 'Bitcoin adoption by countries.'
		});
		await heading.waitFor({ state: 'visible' });

		// Check that Europe section is shown
		const europeHeading = page.getByRole('heading', { name: 'Europe' });
		await europeHeading.waitFor({ state: 'visible' });
		await expect(europeHeading).toBeVisible();

		// Verify dropdown shows Europe selected
		const dropdown = page.getByRole('combobox');
		await expect(dropdown).toHaveValue('europe');

		// Navigate to Asia via direct URL
		await page.goto('http://127.0.0.1:5173/countries/asia');
		await expect(page).toHaveURL(/countries\/asia/);

		const asiaHeading = page.getByRole('heading', { name: 'Asia' });
		await asiaHeading.waitFor({ state: 'visible' });
		await expect(asiaHeading).toBeVisible();

		// Verify dropdown shows Asia selected
		await expect(dropdown).toHaveValue('asia');
	});

	test('updates URL when dropdown selection changes', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/countries/africa');

		// Wait for the page to load
		const heading = page.getByRole('heading', {
			name: 'Bitcoin adoption by countries.'
		});
		await heading.waitFor({ state: 'visible' });

		// Select Europe from dropdown
		const dropdown = page.getByRole('combobox');
		await dropdown.selectOption('europe');

		// Check that Europe section is now shown
		const europeHeading = page.getByRole('heading', { name: 'Europe' });
		await europeHeading.waitFor({ state: 'visible' });
		await expect(europeHeading).toBeVisible();

		// Check that URL updated to Europe
		await expect(page).toHaveURL(/countries\/europe/);

		// Select South America from dropdown
		await dropdown.selectOption('south-america');

		// Check that South America section is now shown
		const southAmericaHeading = page.getByRole('heading', { name: 'South America' });
		await southAmericaHeading.waitFor({ state: 'visible' });
		await expect(southAmericaHeading).toBeVisible();

		// Check that URL updated to South America
		await expect(page).toHaveURL(/countries\/south-america/);
	});

	test('handles invalid route parameters gracefully', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/countries/invalid-section');

		// Should redirect to Africa when invalid section is provided
		await expect(page).toHaveURL(/countries\/africa/);

		// Wait for the page to load
		const heading = page.getByRole('heading', {
			name: 'Bitcoin adoption by countries.'
		});
		await heading.waitFor({ state: 'visible' });

		// Should show Africa section
		const africaHeading = page.getByRole('heading', { name: 'Africa' });
		await africaHeading.waitFor({ state: 'visible' });
		await expect(africaHeading).toBeVisible();

		// Verify dropdown shows Africa selected
		const dropdown = page.getByRole('combobox');
		await expect(dropdown).toHaveValue('africa');
	});

	test('preserves continent selection during navigation', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/countries/oceania');

		// Check that the URL is correct
		await expect(page).toHaveURL(/countries\/oceania/);

		// Wait for the page to load
		const heading = page.getByRole('heading', {
			name: 'Bitcoin adoption by countries.'
		});
		await heading.waitFor({ state: 'visible' });

		// Check that Oceania section is shown
		const oceaniaHeading = page.getByRole('heading', { name: 'Oceania' });
		await oceaniaHeading.waitFor({ state: 'visible' });
		await expect(oceaniaHeading).toBeVisible();

		// Click on leaderboard link and then back
		await page.getByRole('link', { name: 'View leaderboard' }).click();
		await expect(page).toHaveURL(/countries\/leaderboard/);

		// Go back to countries page
		await page.goBack();
		await expect(page).toHaveURL(/countries\/oceania/);

		// Verify Oceania is still selected
		await oceaniaHeading.waitFor({ state: 'visible' });
		await expect(oceaniaHeading).toBeVisible();
	});

	test('continent link in heading works correctly', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/countries/north-america');

		// Check that the URL is correct
		await expect(page).toHaveURL(/countries\/north-america/);

		// Wait for the page to load
		const heading = page.getByRole('heading', {
			name: 'Bitcoin adoption by countries.'
		});
		await heading.waitFor({ state: 'visible' });

		// Check that North America section is shown
		const northAmericaHeading = page.getByRole('heading', { name: 'North America' });
		await northAmericaHeading.waitFor({ state: 'visible' });
		await expect(northAmericaHeading).toBeVisible();

		// Click on the continent heading link
		const continentLink = page.getByRole('link', { name: 'North America' });
		await continentLink.click();

		// Should stay on the same page with the same URL
		await expect(page).toHaveURL(/countries\/north-america/);
		await expect(northAmericaHeading).toBeVisible();
	});
});
