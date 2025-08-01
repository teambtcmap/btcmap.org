import type { Area, Boost, Event, Issue, OSMTags, Place, Report, Theme, User } from '$lib/types';
import { readable, writable, type Writable } from 'svelte/store';

export const socials = readable({
	x: 'https://x.com/btcmap',
	nostr: 'https://nosta.me/nprofile1qqsra2ey033mkdwl5w8q0jss9ak69zafh82xsuvhwsaauw3trkq2amgax6f75',
	discord: 'https://discord.com/invite/9mHeTgX2zb',
	github: 'https://github.com/teambtcmap',
	amboss: 'https://amboss.space/community/edf8d227-9bc7-4cb2-af2a-66c1b455109a'
});

export const apps = readable([
	{
		link: '/map',
		type: 'Web',
		icon: 'web',
		desc: 'Progressive Web App'
	},
	{
		link: 'https://f-droid.org/en/packages/org.btcmap/',
		type: 'F-Droid',
		icon: 'f-droid',
		desc: 'FOSS App Store'
	},
	{
		link: 'https://github.com/teambtcmap/btcmap-android/releases/latest',
		type: 'APK',
		icon: 'android',
		desc: 'Direct Download'
	},
	{
		link: 'https://apps.apple.com/app/btc-world-map/id6443604345',
		type: 'iOS',
		icon: 'ios',
		desc: 'Walled Garden Option'
	}
]);

export const places: Writable<Place[]> = writable([]);
export const placesError = writable('');
export const placesSyncCount = writable(0);

export const users: Writable<User[]> = writable([]);
export const userError = writable('');

export const events: Writable<Event[]> = writable([]);
export const eventError = writable('');

export const areas: Writable<Area[]> = writable([]);
export const areaError = writable('');

export const reports: Writable<Report[]> = writable([]);
export const reportError = writable('');

export const syncStatus: Writable<boolean> = writable();

export const mapUpdates = writable(false);

export const excludeLeader = readable([
	2104834, 9451067, 1722488, 81735, 18545877, 232801, 19880430, 1778799, 21749653
]);

export const boost: Writable<Boost> = writable();
export const exchangeRate: Writable<number | undefined> = writable();
export const resetBoost = writable(0);
export const boostHash: Writable<string> = writable();

export const showTags: Writable<OSMTags | undefined> = writable();
export const taggingIssues: Writable<Issue[] | undefined> = writable();
export const showMore = writable(false);

export const theme: Writable<Theme> = writable();
