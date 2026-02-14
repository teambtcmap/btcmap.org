import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './tests',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Use 3 workers in CI for faster parallel execution */
	workers: process.env.CI ? 3 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: 'html',
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		// baseURL: 'http://127.0.0.1:3000',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',

		/* CI-specific timeouts for slower environments */
		actionTimeout: process.env.CI ? 15000 : 5000,
		navigationTimeout: process.env.CI ? 60000 : 30000,

		/* Identify E2E test requests to prevent API bans */
		extraHTTPHeaders: {
			'User-Agent': 'btcmap-e2e-tests/1.0 (https://github.com/btcmap/btcmap.org)'
		}
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://127.0.0.1:4173'
			}
		}

		// {
		// 	name: 'firefox',
		// 	use: { ...devices['Desktop Firefox'] }
		// },

		// {
		// 	name: 'webkit',
		// 	use: { ...devices['Desktop Safari'] }
		// }

		/* Test against mobile viewports. */
		// {
		//   name: 'Mobile Chrome',
		//   use: { ...devices['Pixel 5'] },
		// },
		// {
		//   name: 'Mobile Safari',
		//   use: { ...devices['iPhone 12'] },
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	],

	/* Run production build for e2e tests to catch production-only errors */
	webServer: {
		command: 'yarn build && yarn preview',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	},

	/* Configure timeouts */
	timeout: process.env.CI ? 180000 : 60000 // 3 minutes for CI, 1 minute for local
});
