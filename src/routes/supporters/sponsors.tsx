export type SponsorshipLevel =
	| "Explorer"
	| "Wayfinder"
	| "Cartographer"
	| "Navigator"
	| "Pioneer"
	| "Pleb";

export const individualLevels: SponsorshipLevel[] = ["Pleb"];

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

export const plebs: Pleb[] = [
	{
		name: "nout",
		url: "https://geyser.fund/profile/nout",
		avatar:
			"https://storage.googleapis.com/geyser-images-distribution-prod-us/59b7c00d-d3dd-45af-9c09-f28e1434a00f_15/image_large.webp",
	},
	{
		name: "name cannot be blank ⚡",
		url: "https://geyser.fund/profile/name cannot be blank ⚡",
		avatar:
			"https://pbs.twimg.com/profile_images/1510190941956620293/ZH_rvqw8_200x200.jpg",
	},
	{
		name: "Stackmore.hodl.Sucre 🔑⚡️🔦",
		url: "https://geyser.fund/profile/Stackmore.hodl.Sucre 🔑⚡️🔦",
		avatar:
			"https://pbs.twimg.com/profile_images/1668018771137552386/7MWHDey8_normal.jpg",
	},
	{
		name: "BlokchainBoog",
		url: "https://geyser.fund/profile/BlokchainBoog",
		avatar:
			"https://pbs.twimg.com/profile_images/1450885431453749250/8oXcF188_normal.jpg",
	},
	{
		name: "teatwo",
		url: "https://geyser.fund/profile/teatwo",
		avatar:
			"https://storage.googleapis.com/geyser-images-distribution-prod-us/0b0b8236-64a7-44c0-bcd5-7c8e7d5a80eb_uasf_implication_jp1/image_large.webp",
	},
	{
		name: "ardevd",
		url: "https://geyser.fund/profile/ardevd",
		avatar: "https://github.com/ardevd",
	},
	{
		name: "nono2357",
		url: "https://geyser.fund/profile/nono2357",
	},
	{
		name: "Vic",
		url: "https://geyser.fund/profile/Vic",
		avatar:
			"https://pbs.twimg.com/profile_images/1550827709953105920/EAStdCMs_200x200.jpg",
	},
	{
		name: "xst_block",
		url: "https://geyser.fund/profile/xst_block",
		avatar:
			"https://storage.googleapis.com/geyser-images-distribution-prod-us/d4259a3d-a4cd-44a1-ad0c-8072a8ae3894_XstBlockLogo/image_large.webp",
	},
	{
		name: "Hunter Biggs",
		url: "https://geyser.fund/profile/Hunter Biggs",
		avatar:
			"https://pbs.twimg.com/profile_images/1476598468001124356/8SveJ6bP_200x200.jpg",
	},
	{
		name: "José",
		url: "https://geyser.fund/profile/José",
	},
];

export const sponsorshipTiers: SponsorshipTier[] = [
	{ level: "Explorer", headline: "Loving what we do" },
	{ level: "Wayfinder", headline: "Supporting the mission" },
	{ level: "Cartographer", headline: "Core ecosystem partner" },
	{ level: "Navigator", headline: "High-conviction industry supporters" },
	{ level: "Pioneer", headline: "Our most committed supporters" },
	{
		level: "Pleb",
		headline: "Every sat counts — ordered by cumulative contributions",
	},
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
