export type SponsorshipLevel =
	| "Explorer"
	| "Wayfinder"
	| "Cartographer"
	| "Navigator"
	| "Pioneer"
	| "Baller"
	| "Chad"
	| "Pleb";

export const individualLevels: SponsorshipLevel[] = ["Pleb", "Chad", "Baller"];

export type Sponsor = {
	name: string;
	url: string;
	icon?: string;
	iconDark?: string;
	level: SponsorshipLevel;
};

export type Pleb = {
	name: string;
	url?: string;
	avatar?: string;
};

export type SponsorshipTier = {
	level: SponsorshipLevel;
	headline: string;
};

export const plebs: Pleb[] = [];

export const chads: Pleb[] = [];

export const ballers: Pleb[] = [
	{
		name: "Nathan Day",
		url: "https://nathan.day.ag",
		avatar: "/images/supporters/plebs/nathan-day.jpg",
	},
];

export const sponsorshipTiers: SponsorshipTier[] = [
	{ level: "Explorer", headline: "Loving what we do" },
	{ level: "Wayfinder", headline: "Supporting the mission" },
	{ level: "Cartographer", headline: "Core ecosystem partner" },
	{ level: "Navigator", headline: "High-conviction industry supporters" },
	{ level: "Pioneer", headline: "Our most committed supporters" },
	{ level: "Baller", headline: "High-conviction individual backers" },
	{ level: "Chad", headline: "Committed community supporters" },
	{ level: "Pleb", headline: "Every sat counts" },
];

export const sponsors: Sponsor[] = [
	{
		name: "Sats n Facts",
		url: "https://geyser.fund/project/satsnfacts",
		icon: "/images/supporters/satsnfacts.png",
		level: "Explorer",
	},
	{
		name: "BTC Curacao",
		url: "https://btccuracao.com/",
		icon: "/images/supporters/btccuracao.png",
		level: "Wayfinder",
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
		level: "Cartographer",
	},
	{
		name: "Coinos",
		url: "https://coinos.io/",
		icon: "/images/supporters/coinos.svg",
		iconDark: "/images/supporters/coinos-dark.svg",
		level: "Navigator",
	},
	{
		name: "Square",
		url: "https://squareup.com/",
		icon: "/images/supporters/square.svg",
		iconDark: "/images/supporters/square-dark.svg",
		level: "Pioneer",
	},
	{
		name: "Spiral",
		url: "https://spiral.xyz/",
		icon: "/images/supporters/spiral.svg",
		level: "Pioneer",
	},
];
