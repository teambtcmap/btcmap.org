export type SponsorshipLevel =
	| "Explorer"
	| "Wayfinder"
	| "Cartographer"
	| "Navigator"
	| "Pioneer"
	| "Pleb";

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
	description: string;
	details: string;
};

export const plebs: Pleb[] = [
	{
		name: "Nathan Day",
		url: "https://btcmap.org",
		avatar: "/images/supporters/plebs/nathan-day.jpg",
	},
];

export const sponsorshipTiers: SponsorshipTier[] = [
	{
		level: "Explorer",
		headline: "First step in backing open maps",
		description:
			"Explorer partners champion the mission and help BTC Map reach more people.",
		details:
			"A strong starting point for teams that want visible support and real ecosystem impact.",
	},
	{
		level: "Wayfinder",
		headline: "Growing product alignment",
		description:
			"Wayfinder partners actively align their product experience with BTC Map’s mission.",
		details:
			"This tier reflects a deeper commitment to helping users discover and use circular bitcoin commerce.",
	},
	{
		level: "Cartographer",
		headline: "Core ecosystem partner",
		description:
			"Cartographer partners make BTC Map a meaningful part of their platform and community strategy.",
		details:
			"Their support helps scale trustworthy merchant discovery across regions and use cases.",
	},
	{
		level: "Navigator",
		headline: "Operational collaboration",
		description:
			"Navigator partners invest in long-term map quality through deeper technical and data collaboration.",
		details:
			"This level strengthens accuracy, reliability, and the long-term health of the BTC Map network.",
	},
	{
		level: "Pioneer",
		headline: "Strategic long-term builder",
		description:
			"Pioneer partners share the deepest commitment to BTC Map as critical open infrastructure for bitcoin adoption.",
		details:
			"Their leadership accelerates global coverage, stronger data quality, and durable ecosystem growth.",
	},
	{
		level: "Pleb",
		headline: "Every sat counts",
		description:
			"Individuals who believe in open bitcoin infrastructure and back it with their own sats.",
		details:
			"The Pleb tier is our community backbone — proof that open-source runs on people, not just organisations.",
	},
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
