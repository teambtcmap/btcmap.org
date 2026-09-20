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
		await expect(
			page.getByText('From OpenStreetMap for your pin')
		).toBeVisible();
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
		// #1425: a miss says so. Claiming a suggestion over an empty box is
		// the bug this replaces.
		await expect(
			page.getByText('No address found for this pin')
		).toBeVisible();
		await expect(
			page.getByText('From OpenStreetMap for your pin')
		).toBeHidden();
	});

	// #1425: doubt about the pin arrives while reading the address, so the
	// action to fix it lives there — under the input, with the clause that
	// says using it costs nothing.
	test('Move pin sits under the address input, below its hint', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		const hint = page.getByText('From OpenStreetMap for your pin');
		const movePin = page.getByRole('button', { name: 'Move pin' });
		await expect(hint).toBeVisible();
		await expect(movePin).toBeVisible();

		const input = await page.locator('#address').boundingBox();
		const hintBox = await hint.boundingBox();
		const pill = await movePin.boundingBox();
		if (!input || !hintBox || !pill) throw new Error('missing geometry');
		// Input, then hint, then the action.
		expect(hintBox.y).toBeGreaterThanOrEqual(input.y + input.height);
		expect(pill.y).toBeGreaterThanOrEqual(hintBox.y + hintBox.height);
		// The old chip carried it above the first field; it must not still.
		expect(pill.y).toBeGreaterThan(input.y);
	});

	// The hint is the field's description only while there is nothing more
	// urgent to say. Appending it to a validation error buries the thing to
	// fix under three sentences of advice — the #1404 contract is that a
	// rejected field describes itself with its error and nothing else.
	test('the hint describes the field, but never dilutes an error', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		const address = page.locator('#address');
		await expect(address).toHaveValue(/Freiheitsstraße/);
		await expect(address).toHaveAccessibleDescription(
			"From OpenStreetMap for your pin — check it's the right entrance. Moving the pin keeps your answers."
		);

		// Blank the required suggestion and get the field rejected.
		await page.locator('#name').fill('Satoshi Comics');
		await page.locator('#category').selectOption('restaurants');
		await page.locator('#onchain').check();
		await page.locator('#contact').fill('owner@example.com');
		await address.fill('');
		await page.getByRole('button', { name: 'Review & submit' }).click();

		await expect(address).toHaveAccessibleDescription('Enter the address.');
	});

	test('the Move pin pill reads at 34px but still takes a 44px tap', async ({
		page
	}) => {
		await stubMapData(page);
		await stubReverseGeocode(page);
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});
		await expect(page.getByRole('button', { name: 'Move pin' })).toBeVisible();

		// Visual weight and hit target are decoupled by a transparent
		// ::after overlay, so probe with elementFromPoint rather than trust
		// the box: a pseudo-element hit resolves to its host.
		const probe = await page.evaluate(() => {
			const button = [...document.querySelectorAll('button')].find(
				(candidate) => candidate.textContent?.trim() === 'Move pin'
			);
			if (!button) return null;
			const box = button.getBoundingClientRect();
			const hits = (y: number) => {
				const el = document.elementFromPoint(box.x + box.width / 2, y);
				return !!el && (el === button || button.contains(el));
			};
			return {
				height: Math.round(box.height),
				above: hits(box.top - 4),
				below: hits(box.bottom + 4)
			};
		});

		expect(probe?.height).toBe(34);
		expect(probe?.above).toBe(true);
		expect(probe?.below).toBe(true);
	});

	test('nothing is claimed about the address while the lookup is pending', async ({
		page
	}) => {
		await stubMapData(page);
		await page.route(
			(u) => u.hostname === 'nominatim.openstreetmap.org',
			async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 2500));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Unable to geocode' })
				});
			}
		);
		await page.goto(PIN);
		await expect(page.locator('#name')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});

		// In flight: neither outcome may be stated. Move pin is offered
		// throughout, so it does not appear mid-read.
		await expect(page.locator('#address')).toHaveAttribute(
			'placeholder',
			'Looking up the address…'
		);
		await expect(
			page.getByText('From OpenStreetMap for your pin')
		).toBeHidden();
		await expect(page.getByText('No address found for this pin')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Move pin' })).toBeVisible();

		// Settled: the miss is stated.
		await expect(page.getByText('No address found for this pin')).toBeVisible({
			timeout: MARKER_LOAD_TIMEOUT
		});
	});
});
