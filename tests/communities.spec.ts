import { test, expect } from '@playwright/test';

test.describe('Communities Page', () => {
	test('loads communities page successfully', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check page title
		const pageTitle = await page.title();
		expect(pageTitle).toContain('BTC Map - Communities');

		// Check main heading
		await expect(
			page.getByRole('heading', { name: /join the bitcoin map community/i })
		).toBeVisible();

		// Check subtitle
		await expect(
			page.getByText(/take ownership of your local bitcoin mapping data/i)
		).toBeVisible();

		// Check that content has loaded
		const bodyContent = await page.locator('body').textContent();
		expect(bodyContent).toBeTruthy();
		expect(bodyContent!.length).toBeGreaterThan(100);
	});

	test('displays navigation buttons', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForLoadState('networkidle');

		// Check primary navigation buttons
		const leaderboardBtn = page.getByRole('link', { name: 'Leaderboard' });
		await expect(leaderboardBtn).toBeVisible();
		await expect(leaderboardBtn).toHaveAttribute('href', '/communities/leaderboard');

		const addCommunityBtn = page.getByRole('link', { name: 'Add community' });
		await expect(addCommunityBtn).toBeVisible();
		await expect(addCommunityBtn).toHaveAttribute('href', '/communities/add');

		const viewMapBtn = page.getByRole('link', { name: 'View community map' });
		await expect(viewMapBtn).toBeVisible();
		await expect(viewMapBtn).toHaveAttribute('href', '/communities/map');
	});

	test('renders communities chart', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForLoadState('networkidle');

		// Wait for chart to render
		await page.waitForTimeout(2000);

		// Check that chart canvas is present
		const chartCanvas = page.locator('canvas');
		await expect(chartCanvas).toBeVisible();

		// Check that chart has proper dimensions
		const canvasWidth = await chartCanvas.getAttribute('width');
		const canvasHeight = await chartCanvas.getAttribute('height');
		expect(canvasWidth).toBe('100%');
		expect(canvasHeight).toBe('350');
	});

	test('defaults to Africa section', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForLoadState('networkidle');

		// Should redirect to Africa section
		await expect(page).toHaveURL(/\/communities\/africa$/);

		// Check that Africa section is displayed
		const africaHeading = page.getByRole('heading', { name: 'Africa' });
		await expect(africaHeading).toBeVisible();

		// Check that the select dropdown shows Africa as selected
		const sectionSelect = page.locator('select');
		if ((await sectionSelect.count()) > 0) {
			const selectedValue = await sectionSelect.inputValue();
			expect(selectedValue).toBe('africa');
		}
	});

	test('navigates to different continent sections via routes', async ({ page }) => {
		const continents = [
			{ section: 'africa', name: 'Africa' },
			{ section: 'asia', name: 'Asia' },
			{ section: 'europe', name: 'Europe' },
			{ section: 'north-america', name: 'North America' },
			{ section: 'oceania', name: 'Oceania' },
			{ section: 'south-america', name: 'South America' }
		];

		for (const continent of continents) {
			await page.goto(`http://127.0.0.1:5173/communities/${continent.section}`);
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(1000);

			// Check URL contains section
			await expect(page).toHaveURL(
				new RegExp(`/communities/${continent.section.replace('-', '\\-')}$`)
			);

			// Check that correct continent heading is displayed
			const continentHeading = page.getByRole('heading', { name: continent.name });
			await expect(continentHeading).toBeVisible();

			// Check that section select shows correct value
			const sectionSelect = page.locator('select');
			if ((await sectionSelect.count()) > 0) {
				const selectedValue = await sectionSelect.inputValue();
				expect(selectedValue).toBe(continent.section);
			}
		}
	});

	test('changes section via dropdown selection', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities/africa');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Check if dropdown is available
		const sectionSelect = page.locator('select');
		if ((await sectionSelect.count()) > 0) {
			// Select a different continent
			await sectionSelect.selectOption('asia');
			await page.waitForTimeout(500);

			// Check that URL updated with new route
			await expect(page).toHaveURL(/\/communities\/asia$/);

			// Check that Asia section is displayed
			const asiaHeading = page.getByRole('heading', { name: 'Asia' });
			await expect(asiaHeading).toBeVisible();

			// Test another continent
			await sectionSelect.selectOption('europe');
			await page.waitForTimeout(500);

			// Check that URL updated
			await expect(page).toHaveURL(/\/communities\/europe$/);

			// Check that Europe section is displayed
			const europeHeading = page.getByRole('heading', { name: 'Europe' });
			await expect(europeHeading).toBeVisible();
		}
	});

	test('displays community sections and content', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities/africa');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Check that community section component is rendered
		const communitySection = page.locator('main').locator('div').last();
		await expect(communitySection).toBeVisible();

		// Check for community links (if any communities exist)
		const communityLinks = page.locator('a[href^="/community/"]');
		if ((await communityLinks.count()) > 0) {
			await expect(communityLinks.first()).toBeVisible();

			// Test clicking on a community link
			const firstCommunityLink = communityLinks.first();
			const href = await firstCommunityLink.getAttribute('href');
			expect(href).toMatch(/^\/community\/[^/]+$/);
		}
	});

	test('handles organization sections', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities/africa');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Check if dropdown has organization options
		const sectionSelect = page.locator('select');
		if ((await sectionSelect.count()) > 0) {
			const options = await sectionSelect.locator('option').allTextContents();

			// Look for organization headers and options
			const hasOrganizations = options.some((option) => option.includes('--Organizations--'));

			if (hasOrganizations) {
				// Find first organization option (not disabled)
				const organizationOptions = options.filter(
					(option) =>
						!option.includes('--') &&
						!['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'].includes(
							option
						)
				);

				if (organizationOptions.length > 0) {
					const firstOrg = organizationOptions[0];
					await sectionSelect.selectOption(firstOrg);
					await page.waitForTimeout(500);

					// Check that URL updated with organization route
					await expect(page).toHaveURL(new RegExp(`/communities/${encodeURIComponent(firstOrg)}$`));

					// Check that organization section heading is displayed
					const orgHeading = page.getByRole('heading', { name: firstOrg });
					await expect(orgHeading).toBeVisible();
				}
			}
		}
	});

	test('handles invalid sections gracefully', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities/invalid-section');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Should redirect to default (Africa) for invalid section
		await expect(page).toHaveURL(/\/communities\/africa$/);

		// Should display Africa section
		const africaHeading = page.getByRole('heading', { name: 'Africa' });
		await expect(africaHeading).toBeVisible();

		// Page should still be functional
		const bodyContent = await page.locator('body').textContent();
		expect(bodyContent).toBeTruthy();
		expect(bodyContent!.length).toBeGreaterThan(100);
	});

	test('preserves section when navigating back', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities/asia');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Navigate to another page
		await page.goto('http://127.0.0.1:5173/');
		await page.waitForLoadState('networkidle');

		// Go back
		await page.goBack();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);

		// Should still be on Asia section
		await expect(page).toHaveURL(/\/communities\/asia$/);
		const asiaHeading = page.getByRole('heading', { name: 'Asia' });
		await expect(asiaHeading).toBeVisible();
	});

	test('section heading links work correctly', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities/europe');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Check that section heading is a link
		const sectionHeadingLink = page.getByRole('heading', { name: 'Europe' }).locator('a');
		if ((await sectionHeadingLink.count()) > 0) {
			await expect(sectionHeadingLink).toHaveAttribute('href', '/communities/europe');

			// Click the link
			await sectionHeadingLink.click();
			await page.waitForTimeout(500);

			// Should still be on the same section
			await expect(page).toHaveURL(/\/communities\/europe$/);
			const europeHeading = page.getByRole('heading', { name: 'Europe' });
			await expect(europeHeading).toBeVisible();
		}
	});

	test('loads without JavaScript gracefully', async ({ browser }) => {
		// Create context with JavaScript disabled
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();

		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForLoadState('networkidle');

		// Check basic content loads
		await expect(page.getByText(/join the bitcoin map community/i)).toBeVisible();
		await expect(
			page.getByText(/take ownership of your local bitcoin mapping data/i)
		).toBeVisible();

		// Check that buttons are still visible
		const leaderboardBtn = page.getByRole('link', { name: 'Leaderboard' });
		await expect(leaderboardBtn).toBeVisible();

		// Clean up
		await context.close();
	});

	test('responsive design elements work', async ({ page }) => {
		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForLoadState('networkidle');

		// Check that content is still visible in mobile view
		await expect(page.getByText(/join the bitcoin map community/i)).toBeVisible();

		// Check that navigation buttons are still accessible
		const leaderboardBtn = page.getByRole('link', { name: 'Leaderboard' });
		await expect(leaderboardBtn).toBeVisible();

		// Test desktop viewport
		await page.setViewportSize({ width: 1200, height: 800 });
		await page.waitForTimeout(500);

		// Content should still be visible
		await expect(page.getByText(/join the bitcoin map community/i)).toBeVisible();
	});

	test('handles loading states properly', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for content to load

		// Wait for content to load
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Check that main content is now visible
		await expect(page.getByText(/join the bitcoin map community/i)).toBeVisible();

		// Chart should be rendered
		const chartCanvas = page.locator('canvas');
		await expect(chartCanvas).toBeVisible();
	});
});
