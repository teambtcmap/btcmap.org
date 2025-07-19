import { test, expect } from '@playwright/test';

test.describe('Areas', () => {
	test('opens country area', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173');

		const heading = page.getByRole('heading', {
			name: 'Find places to spend sats wherever you are.'
		});
		await heading.waitFor({ state: 'visible' });
		await expect(heading).toBeTruthy();

		await page.getByRole('button', { name: 'Areas' }).click();
		await page.getByRole('link', { name: 'Countries' }).click();
		await expect(page).toHaveURL(/countries/);

		await page.getByRole('link', { name: 'South Africa' }).click();
		await expect(page).toHaveURL(/country\/za/);

		await page
			.getByRole('heading', {
				name: 'South Africa',
				exact: true
			})
			.waitFor({ state: 'visible' });
	});

	test('opens community and generate boost invoice for first merchant', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173');

		const heading = page.getByRole('heading', {
			name: 'Find places to spend sats wherever you are.'
		});
		await heading.waitFor({ state: 'visible' });
		await expect(heading).toBeTruthy();

		await page.getByRole('button', { name: 'Areas' }).click();
		await page.getByRole('link', { name: 'Communities' }).click();
		await expect(page).toHaveURL(/communities/);

		const communityHeading = page.getByRole('heading', {
			name: 'Join the bitcoin map community.'
		});
		await communityHeading.waitFor({ state: 'visible' });
		await expect(communityHeading).toBeTruthy();

		// Find the first community link matching the pattern and click it (should be first community)
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await firstCommunityLink.click();
		await expect(page).toHaveURL(/\/community\/[^/]+$/);

		// Find the first merchant link matching the pattern and click it (should be first merchant)
		const firstMerchantLink = page.locator('a[href^="/merchant/node:"]').first();
		await firstMerchantLink.click();
		await expect(page).toHaveURL(/\/merchant\/node:[^/]+$/);

		// Click "Boost" Button
		const boostLink = page.getByRole('button', { name: /Boost/i });
		await boostLink.click({ timeout: 120000 });

		// wait for boost modal to show up
		const boostLocationHeading = page.getByText('Boost Location');
		await boostLocationHeading.waitFor({ state: 'visible' });
		await expect(boostLocationHeading).toBeTruthy();

		// "Boost" button in modal should be disabled
		const disabledBoostButton = page.getByRole('button', { name: 'Boost', exact: true });
		await expect(disabledBoostButton).toBeDisabled();

		// Click the button "5$ / 1 month" option
		const oneMonthButton = page.getByRole('button', { name: /1 month/i });
		await oneMonthButton.click();

		// "Boost" button should now be enabled and have the exact text "Boost for 1 month"
		const boostForOneMonthButton = page.getByRole('button', {
			name: 'Boost for 1 month',
			exact: true
		});
		await expect(boostForOneMonthButton).toBeVisible();
	});

	test('community leaderboard sorting', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173');

		const heading = page.getByRole('heading', {
			name: 'Find places to spend sats wherever you are.'
		});
		await heading.waitFor({ state: 'visible' });
		await expect(heading).toBeTruthy();

		await page.getByRole('button', { name: 'Areas' }).click();
		await page.getByRole('link', { name: 'Communities' }).click();
		await expect(page).toHaveURL(/communities/);

		await page.getByRole('link', { name: 'Leaderboard' }).click();
		await expect(page).toHaveURL(/communities\/leaderboard/);

		await page
			.getByRole('heading', {
				name: 'Community Leaderboard'
			})
			.waitFor({ state: 'visible' });

		const goldMedalCell = page.getByRole('cell', { name: '🥇' });

		await goldMedalCell.waitFor({ state: 'visible', timeout: 20000 });
		await expect(goldMedalCell).toBeVisible();

		// Test sorting functionality by clicking "Position" column header twice to reverse sort
		await page.getByRole('button', { name: 'Position' }).click();
		await page.getByRole('button', { name: 'Position' }).click();

		// Wait for the medal to disappear (indicating sorting worked)
		await goldMedalCell.waitFor({ state: 'hidden', timeout: 5000 });
	});
});
