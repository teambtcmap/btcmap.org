import { readFileSync } from 'node:fs';

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import type en from '#lib/i18n/locales/en.json';
import type { EarnedBadge } from '#lib/types.js';

import { stubMapData } from './helpers';

// [type, key] of a badge; the key has to be one of its type's keys in en.json
type BadgeRef<B = EarnedBadge> = B extends EarnedBadge ? [`${B['type']}`, B['key']] : never;

// The tagger from the #1099 report. The server render still reads this user
// from the live API; every request the browser makes is stubbed below.
const TAGGER_ID = 6794624;

const at = '2024-01-01T00:00:00.000Z';

// A supporter with 10 created places and no other tagger earns these badges,
// in the page's order: Supporter, Top Tagger, Podium, High Rank, Creator and
// Heartbeat (10 or more). Four of the six German titles differ from English.
const EARNED: BadgeRef[] = [
	['achievement', 'supporter'],
	['achievement', 'topTagger'],
	['achievement', 'podium'],
	['achievement', 'highRank'],
	['achievement', 'creator'],
	['contribution', 'heartbeat']
];

const USERS = [
	{
		id: TAGGER_ID,
		osm_json: {
			id: TAGGER_ID,
			display_name: 'Comino',
			description: '',
			img: null,
			account_created: at
		},
		tags: { 'supporter:expires': '2099-01-01T00:00:00.000Z' },
		created_at: at,
		updated_at: at,
		deleted_at: ''
	}
];

const EVENTS = Array.from({ length: 10 }, (_, i) => ({
	id: i + 1,
	user_id: TAGGER_ID,
	element_id: `node:${i + 1}`,
	type: 'create',
	tags: {},
	created_at: at,
	updated_at: at,
	deleted_at: ''
}));

// Typed as en.json: the badges.* and footer.language keys this spec reads
// are in every locale file
const locale = (language: string): typeof en =>
	JSON.parse(
		readFileSync(new URL(`../src/lib/i18n/locales/${language}.json`, import.meta.url), 'utf8')
	);

const badgeTitles = (language: string) => {
	const { badges } = locale(language);
	return EARNED.map(([type, key]) =>
		type === 'achievement' ? badges.achievement[key].title : badges.contribution[key].title
	);
};

const altTexts = (badges: Locator) =>
	badges.getByRole('img').evaluateAll((images) => images.map((image) => image.getAttribute('alt')));

const json = (body: unknown) => ({
	status: 200,
	contentType: 'application/json',
	body: JSON.stringify(body)
});

// The page waits for the full users and events syncs, which take minutes
// against the live API on a cold start. Serve a small fixed set instead.
async function stubTaggerData(page: Page) {
	await stubMapData(page);
	await page.route(
		(u) => u.hostname === 'api.btcmap.org' && u.pathname.startsWith('/v2/'),
		(route) => route.fulfill(json([]))
	);
	await page.route(
		(u) => u.hostname === 'api.btcmap.org' && u.pathname === '/v2/users',
		(route) => route.fulfill(json(USERS))
	);
	await page.route(
		(u) => u.hostname === 'api.btcmap.org' && u.pathname === '/v2/events',
		(route) => route.fulfill(json(EVENTS))
	);
	// The page's universal load runs again in the browser on hydration
	await page.route(
		(u) => u.hostname === 'api.btcmap.org' && u.pathname === `/v2/users/${TAGGER_ID}`,
		(route) => route.fulfill(json(USERS[0]))
	);
}

test.describe('Tagger profile', () => {
	// The prod build's service worker hides the data requests from page.route
	test.use({ serviceWorkers: 'block' });

	for (const language of ['en', 'de']) {
		test(`shows the badge titles in the app language (${language})`, async ({ page }) => {
			await stubTaggerData(page);
			const titles = badgeTitles(language);

			await page.goto(`/tagger/${TAGGER_ID}?language=${language}`);

			const badges = page.locator('#badges').getByRole('link');
			await expect(badges).toHaveText(titles, { timeout: 30000 });
			expect(await altTexts(badges)).toEqual(titles);
		});
	}

	test('updates the badge titles when the language changes on the open page', async ({
		page
	}) => {
		await stubTaggerData(page);
		await page.goto(`/tagger/${TAGGER_ID}?language=de`);

		const section = page.locator('#badges');
		const badges = section.getByRole('link');
		await expect(badges).toHaveText(badgeTitles('de'), { timeout: 30000 });

		// English is loaded already, as the fallback, so the switch does not
		// remount the page; the mark shows the same section is updated
		await section.evaluate((element) => element.setAttribute('data-test-mark', 'before-switch'));
		await page.getByRole('button', { name: locale('de').footer.language }).click();
		await page.getByRole('dialog').getByRole('button', { name: /^English/ }).click();

		const titles = badgeTitles('en');
		await expect(badges).toHaveText(titles);
		expect(await altTexts(badges)).toEqual(titles);
		await expect(section).toHaveAttribute('data-test-mark', 'before-switch');
	});
});
