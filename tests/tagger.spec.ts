import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { stubMapData } from './helpers';

// The tagger from the #1099 report. The server render still reads this user
// from the live API; every request the browser makes is stubbed below.
const TAGGER_ID = 6794624;

const at = '2024-01-01T00:00:00.000Z';

// A supporter with 10 created places and no other tagger earns these badges,
// in the page's order: Supporter, Top Tagger, Podium, High Rank, Creator and
// Heartbeat (10 or more). Four of the six German titles differ from English.
const EARNED = [
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

const badgeTitles = (language: string) => {
	const { badges } = JSON.parse(
		readFileSync(new URL(`../src/lib/i18n/locales/${language}.json`, import.meta.url), 'utf8')
	);
	return EARNED.map(([type, key]) => badges[type][key].title);
};

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
			const alts = await badges
				.getByRole('img')
				.evaluateAll((images) => images.map((image) => image.getAttribute('alt')));
			expect(alts).toEqual(titles);
		});
	}
});
