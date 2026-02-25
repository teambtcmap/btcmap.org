import { test, expect } from '@playwright/test';

test.describe('Countries', () => {
	test('redirects to Africa section by default', async ({ page }) => {
		await page.goto('/countries');

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

	test('updates URL when dropdown selection changes', async ({ page }) => {
		await page.goto('/countries/africa');

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

	test('country names translate when switching to PT', async ({ page }) => {
		await page.goto('/countries/africa');

		// Wait for country cards to load (areas sync is async)
		const countryCards = page.locator('[data-testid="country-name"]');
		await countryCards.first().waitFor({ state: 'visible', timeout: 30000 });
		const englishName = (await countryCards.first().textContent()) ?? '';

		// Click PT language button
		const ptButton = page.getByRole('button', { name: /Switch to Portuguese|Mudar para Português/i });
		await ptButton.click();

		// Wait until the first country card text changes from its English name
		await expect(countryCards.first()).not.toHaveText(englishName, { timeout: 10000 });

		const portugueseName = await countryCards.first().textContent();
		expect(portugueseName?.length).toBeGreaterThan(0);
	});
});
