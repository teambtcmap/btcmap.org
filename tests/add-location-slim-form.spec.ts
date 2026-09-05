import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, stubReverseGeocode } from './helpers';

// Step 2 of the add-location redesign: slim details form (#1134) —
// category picker and optional fields behind the "Add more details"
// expander. The form lives on the map now (#1134): ?add=form opens it at
// the hash pin. stubMapData keeps the host hermetic; the arrival address
// lookup (#1315) is stubbed too, and the SW block lets page.route see it.
// The pin sits in the shared STUB_PLACES viewport so the map-ready
// helper (rendered-marker count) has features to see.
const PIN = '/map?add=form#17/42.2762511/42.7024218';

test.describe('Add Location — slim form', () => {
	test.use({ serviceWorkers: 'block' });

	test('category is a picker and Other reveals a required text input', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		// The map host boots slowly under parallel workers — wait on the
		// form itself, the only readiness these specs care about.
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		const category = page.locator('#category');
		await expect(category).toBeVisible();
		// Taxonomy options present, no free-text field by default.
		await expect(category.locator('option[value="restaurants"]')).toHaveCount(1);
		await expect(page.locator('input[name="category-other"]')).toHaveCount(0);

		await category.selectOption('Other');
		const other = page.locator('input[name="category-other"]');
		await expect(other).toBeVisible();
		await expect(other).toHaveAttribute('required', '');
	});

	test('optional fields sit behind the expander and stay functional', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		// The map host boots slowly under parallel workers — wait on the
		// form itself, the only readiness these specs care about.
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		const websiteInput = page.locator('input[name="website"]');
		await expect(websiteInput).toBeHidden();

		const toggle = page.getByRole('button', { name: /Add more details/ });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(websiteInput).toBeVisible();
		await websiteInput.fill('https://example.com');
		// Collapse again — the value survives because the group stays mounted.
		await toggle.click();
		await expect(websiteInput).toBeHidden();
		await toggle.click();
		await expect(websiteInput).toHaveValue('https://example.com');
	});

	test('opening hours unfold as a day grid and produce OSM syntax', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		// The map host boots slowly under parallel workers — wait on the
		// form itself, the only readiness these specs care about.
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		// The editor sits behind its own accordion row inside the expander.
		await page.getByRole('button', { name: /Add more details/ }).click();
		const toggle = page.getByRole('button', { name: /Set opening hours/ });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await toggle.click();

		// Open Monday with the default 09:00–17:00 range.
		await page.getByRole('checkbox', { name: 'Monday' }).check();
		await expect(page.locator('#opening-hours-editor code')).toHaveText(
			'Mo 09:00-17:00'
		);

		// Clearing a time drops the day from the generated string — that
		// must be said out loud, not silent (#1317 review finding).
		const openingTime = page.getByLabel('Opening time');
		await openingTime.fill('');
		await expect(page.locator('#opening-hours-editor code')).toHaveText(
			'Not set'
		);
		await expect(
			page.getByText(/missing its opening or closing time/)
		).toBeVisible();
		await openingTime.fill('09:00');
		await expect(
			page.getByText(/missing its opening or closing time/)
		).toBeHidden();

		// The 24/7 shortcut overrides the grid.
		await page.getByRole('checkbox', { name: 'Open 24/7' }).check();
		await expect(page.locator('#opening-hours-editor code')).toHaveText('24/7');

		// Collapsing keeps the generated value visible as a summary.
		await toggle.click();
		await expect(page.locator('code', { hasText: '24/7' })).toBeVisible();
	});

	test('a signed-in session shows the submitting-as chip and relaxes email', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		// Seeded before any app script runs — the session store reads
		// localStorage at module init.
		await page.addInitScript(() => {
			localStorage.setItem(
				'btcmap_session',
				JSON.stringify({
					username: 'satoshi',
					password: '',
					token: 'test-token',
					savedPlaces: [],
					savedAreas: [],
					autoGenerated: false,
					npub: null
				})
			);
		});
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		// The identity chip replaces the anonymous contact copy, and the
		// email field is no longer required — the account is the identity.
		await expect(page.getByText('Submitting as satoshi')).toBeVisible();
		await expect(page.locator('#contact')).not.toHaveAttribute('required');
		await expect(page.locator('label[for="contact"]')).toContainText(
			'(optional)'
		);
	});
});
