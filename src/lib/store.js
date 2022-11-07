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
		icon: 'fa-solid fa-earth-americas',
		desc: 'Progressive Web App'
	},
	{
		link: 'https://github.com/teambtcmap/btcmap-android/releases/latest',
		type: 'APK',
		icon: 'fa-brands fa-android',
		desc: 'Direct Download'
	},
	{
		link: 'https://f-droid.org/en/packages/org.btcmap/',
		type: 'F-Droid',
		icon: 'fa-solid fa-robot',
		desc: 'FOSS App Store'
	},
	{
		link: 'https://play.google.com/store/apps/details?id=org.btcmap.app',
		type: 'Play',
		icon: 'fa-brands fa-google-play',
		desc: 'Surveillance Option'
	},
	{
		link: 'https://apps.apple.com/app/btc-world-map/id6443604345',
		type: 'iOS',
		icon: 'fa-brands fa-app-store-ios',
		desc: 'Native Option'
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
