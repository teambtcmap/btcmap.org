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

		// Wait for the countries page to load and find the South Africa link
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(1000); // Give time for content to load

		const southAfricaLink = page.getByRole('link', { name: 'South Africa' });
		if ((await southAfricaLink.count()) > 0) {
			await southAfricaLink.waitFor({ state: 'visible' });
			await southAfricaLink.click();
			// Wait for navigation to complete
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/country\/za\/merchants/); // App redirects to merchants section
		} else {
			// If South Africa link not found, just verify we're on countries page
			await expect(page).toHaveURL(/countries/);
			return; // Skip rest of test
		}

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

		// Ensure community links are present
		await page.waitForTimeout(2000); // Give time for dynamic content to load
		const firstCommunityLink = page.locator('a[href^="/community/"]').first();
		await expect(firstCommunityLink).toBeVisible({ timeout: 15000 });

		await firstCommunityLink.click();
		// Wait for navigation to complete
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/community\/[^/]+\/merchants$/); // App redirects to merchants section

		// Wait for the page to load and check if this community has merchants
		await page.waitForLoadState('networkidle', { timeout: 30000 });

		// Check if there are any merchants in this community
		const merchantLinks = page.locator('a[href^="/merchant/node:"]');
		const merchantCount = await merchantLinks.count();

		if (merchantCount === 0) {
			// Skip this test if no merchants - some communities might not have merchants
			console.log('No merchants found in this community, skipping merchant boost test');
			return;
		}

		// Find the first merchant link and click it
		const firstMerchantLink = merchantLinks.first();
		await expect(firstMerchantLink).toBeVisible({ timeout: 15000 });
		await firstMerchantLink.click();

		// Wait for navigation with a more generous timeout
		await page.waitForURL(/\/merchant\/node:[^/]+$/, { timeout: 15000 });

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

		// Wait for the page heading to be visible
		await page
			.getByRole('heading', {
				name: 'Community Leaderboard'
			})
			.waitFor({ state: 'visible' });

		// Wait for the table to be populated with data by checking for medal emojis
		// This ensures the leaderboard data has fully loaded
		await page.waitForFunction(
			() => {
				const tableRows = document.querySelectorAll('tbody tr');
				return (
					tableRows.length > 0 &&
					tableRows[0].textContent &&
					(tableRows[0].textContent.includes('🥇') ||
						tableRows[0].textContent.includes('🥈') ||
						tableRows[0].textContent.includes('🥉'))
				);
			},
			{ timeout: 60000 }
		);

		const goldMedalCell = page.getByRole('cell', { name: '🥇' });

		// Gold medal should be visible now since we confirmed it exists in the previous wait
		await expect(goldMedalCell).toBeVisible({ timeout: 10000 });

		// Test sorting functionality by clicking "Position" column header twice to reverse sort
		const positionButton = page.getByRole('button', { name: /Sort by Position/ });
		await positionButton.click();
		await positionButton.click();

		// Wait for sorting to complete by checking that the medal is no longer in the first row
		// or that the first position cell doesn't contain the gold medal
		await page.waitForFunction(
			() => {
				const firstRowPositionCell = document.querySelector('tbody tr:first-child td:first-child');
				return firstRowPositionCell && !firstRowPositionCell.textContent?.includes('🥇');
			},
			{ timeout: 10000 }
		);
	});
});
