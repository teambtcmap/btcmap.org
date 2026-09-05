import { expect, test } from '@playwright/test';

import { MARKER_LOAD_TIMEOUT, stubMapData, stubReverseGeocode } from './helpers';

// Address suggestion from the pin (#1315): the field is promoted out of
// the details expander and pre-filled by one reverse-geocode of the pin.
// A fulfilled suggestion locks the field to required — editable but not
// blankable; a miss degrades to the old empty optional field. The form
// lives on the map now (#1134) — stubMapData keeps the host hermetic.
// The pin sits in the shared STUB_PLACES viewport so the map-ready
// helper (rendered-marker count) has features to see.
const PIN = '/map?add=form#17/42.2762511/42.7024218';

test.describe('Add Location — address suggestion from the pin', () => {
	test.use({ serviceWorkers: 'block' });

	test('prefills the address from the pin and makes it required', async ({
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

		const address = page.locator('#address');
		await expect(address).toHaveValue('Freiheitsstraße 21, 10115 Berlin');
		await expect(address).toHaveAttribute('required', '');
		// The field sits on the main form, not behind the expander, with the
		// OpenStreetMap attribution/confirm hint and no "(optional)" tag.
		await expect(page.getByText('Suggested from OpenStreetMap')).toBeVisible();
		await expect(page.locator('label[for="address"]')).not.toContainText(
			'(optional)'
		);

		// Suggested, not authoritative: still editable.
		await address.fill('Corrected 1, 10115 Berlin');
		await expect(address).toHaveValue('Corrected 1, 10115 Berlin');
	});

	test('typing before the lookup settles keeps the text and still locks required', async ({
		page
	}) => {
		await stubMapData(page);
		// Delayed stub: the user gets to the field before the hit lands, so
		// the suggestion must not overwrite their text — but the field still
		// flips to required (review finding on #1316).
		await page.route(
			(u) => u.hostname === 'nominatim.openstreetmap.org',
			async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 1500));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						address: {
							house_number: '21',
							road: 'Freiheitsstraße',
							city: 'Berlin',
							postcode: '10115'
						}
					})
				});
			}
		);
		// The map host boots slowly under parallel workers — wait on the
		// form itself, the only readiness these specs care about.
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		const address = page.locator('#address');
		await address.fill('My own address 5');
		await expect(address).toHaveAttribute('required', '');
		await expect(address).toHaveValue('My own address 5');
	});

	test('a failed lookup leaves the field empty and optional', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page, null);
		// The map host boots slowly under parallel workers — wait on the
		// form itself, the only readiness these specs care about.
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		const address = page.locator('#address');
		// The placeholder flip marks the lookup as settled.
		await expect(address).toHaveAttribute(
			'placeholder',
			'2100 Freedom Drive...'
		);
		await expect(address).toHaveValue('');
		await expect(address).not.toHaveAttribute('required');
		await expect(page.locator('label[for="address"]')).toContainText(
			'(optional)'
		);
	});
});
