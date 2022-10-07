import { writable, readable } from 'svelte/store';

export const socials = readable({
	twitter: 'https://twitter.com/BTCMapDotOrg',
	discord: 'https://discord.gg/wPqva83uzq',
	github: 'https://github.com/teambtcmap'
});

export const apps = readable({
	fdroid: 'https://f-droid.org/en/packages/org.btcmap/',
	direct: 'https://github.com/teambtcmap/btcmap-android/releases/latest',
	web: '/map',
	play: 'https://play.google.com/store/apps/details?id=org.btcmap.app'
});
