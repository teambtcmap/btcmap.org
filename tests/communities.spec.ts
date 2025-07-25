import { test, expect } from '@playwright/test';

test.describe('Communities Page', () => {
	test('loads communities page successfully', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities');

		// Wait for page to load
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(500);

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
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(500);

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
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(500);

		// Wait for chart to render
		await page.waitForTimeout(2000);

		// Check that chart canvas is present
		const chartCanvas = page.locator('canvas');
		await expect(chartCanvas).toBeVisible();

		// Check that chart has proper dimensions
		const canvasWidth = await chartCanvas.getAttribute('width');
		const canvasHeight = await chartCanvas.getAttribute('height');
		// Width is set to actual pixel value, not percentage
		expect(parseInt(canvasWidth || '0')).toBeGreaterThan(0);
		expect(canvasHeight).toBe('350');
	});

	test('defaults to Africa section', async ({ page }) => {
		await page.goto('http://127.0.0.1:5173/communities');
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(500);

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
});
