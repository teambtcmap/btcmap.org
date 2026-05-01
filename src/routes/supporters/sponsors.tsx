export type SponsorshipLevel =
	| "Explorer"
	| "Wayfinder"
	| "Cartographer"
	| "Navigator"
	| "Pioneer"
	| "Pleb";

export const individualLevels: SponsorshipLevel[] = ["Pleb"];

// Individual supporters are fetched server-side from the Geyser leaderboard.
// See +page.server.ts.

export type Sponsor = {
	name: string;
	url: string;
	icon?: string;
	iconDark?: string;
	level: SponsorshipLevel;
};

export type Pleb = {
	id: string;
	name: string;
	url?: string;
	avatar?: string;
	sats?: number;
};

export type SponsorshipTier = {
	level: SponsorshipLevel;
	headlineKey: string;
};

export const sponsorshipTiers: SponsorshipTier[] = [
	{ level: "Explorer", headlineKey: "supporters.tiers.explorer.headline" },
	{ level: "Wayfinder", headlineKey: "supporters.tiers.wayfinder.headline" },
	{
		level: "Cartographer",
		headlineKey: "supporters.tiers.cartographer.headline",
	},
	{ level: "Navigator", headlineKey: "supporters.tiers.navigator.headline" },
	{ level: "Pioneer", headlineKey: "supporters.tiers.pioneer.headline" },
	{ level: "Pleb", headlineKey: "supporters.tiers.pleb.headline" },
];

export const sponsors: Sponsor[] = [
	{
		name: "JAN3",
		url: "https://jan3.com",
		icon: "/images/supporters/jan3.svg",
		iconDark: "/images/supporters/jan3-dark.svg",
		level: "Explorer",
	},
	{
		name: "Sats n Facts",
		url: "https://geyser.fund/project/satsnfacts",
		icon: "/images/supporters/satsnfacts.png",
		level: "Explorer",
	},
	{
		name: "Bittylicious",
		url: "https://bittylicious.com/",
		icon: "/images/supporters/bittylicious.png",
		level: "Explorer",
	},
	{
		name: "BTC Curacao",
		url: "https://btccuracao.com/",
		icon: "/images/supporters/btccuracao.png",
		level: "Cartographer",
	},
	{
		name: "OpenSats",
		url: "https://opensats.org/",
		icon: "/images/supporters/opensats.png",
		level: "Wayfinder",
	},
	{
		name: "Wallet of Satoshi",
		url: "https://www.walletofsatoshi.com/",
		icon: "/images/supporters/wos.png",
		level: "Navigator",
	},
	{
		name: "Coinos",
		url: "https://coinos.io/",
		icon: "/images/supporters/coinos.svg",
		iconDark: "/images/supporters/coinos-dark.svg",
		level: "Wayfinder",
	},
	{
		name: "Spiral",
		url: "https://spiral.xyz/",
		icon: "/images/supporters/spiral.svg",
		level: "Pioneer",
	},
	{
		name: "Square",
		url: "https://squareup.com/",
		icon: "/images/supporters/square.svg",
		iconDark: "/images/supporters/square-dark.svg",
		level: "Pioneer",
	},
];
