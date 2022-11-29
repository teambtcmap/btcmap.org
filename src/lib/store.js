import { writable, readable } from 'svelte/store';

export const socials = readable({
	twitter: 'https://twitter.com/BTCMapDotOrg',
	discord: 'https://discord.gg/wPqva83uzq',
	github: 'https://github.com/teambtcmap'
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
		link: 'https://play.google.com/store/apps/details?id=org.btcmap.app',
		type: 'Play',
		icon: 'play',
		desc: 'Surveillance Option'
	},
	{
		link: 'https://apps.apple.com/app/btc-world-map/id6443604345',
		type: 'iOS',
		icon: 'ios',
		desc: 'Surveillance Option'
	}
]);

export const elements = writable([]);
export const mapUpdates = writable(false);
export const elementError = writable('');
export const mapLoading = writable('Loading map...');

export const users = writable([]);
export const userError = writable('');

export const events = writable([]);
export const eventError = writable('');

export const syncStatus = writable();

export const excludeLeader = readable([17085479, 2104834, 9451067, 616463, 1722488, 81735]);
