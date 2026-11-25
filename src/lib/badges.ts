import type { EarnedBadge, ProfileLeaderboard } from "#lib/types.js";
import { BadgeType } from "#lib/types.js";

type Achievement = Extract<EarnedBadge, { type: BadgeType.Achievement }>;
type Contribution = Extract<EarnedBadge, { type: BadgeType.Contribution }>;

export type TaggerStats = {
	userId: number;
	// When the BTC Map account was created
	joinedAt: string;
	supporter: boolean;
	hasAvatar: boolean;
	hasLightning: boolean;
	// Place on the leaderboard (see taggerRank), null when not on it
	rank: number | null;
	created: number;
	updated: number;
	deleted: number;
};

const GEYSER_TOURNAMENT_TAGGERS = [
	10396321, 17441326, 17199501, 668096, 17462838, 17221642, 5432507, 17354902,
	18452174, 18360665, 616774, 18062435, 7522075, 18380975, 1697546, 19288099,
	11903494, 18552145, 1836965, 19795869, 17872, 19768735, 17573979, 2929493,
	19714509, 1851550, 18244560, 19756689, 527105, 2339960, 17322349, 17300693,
	1236325, 1787080,
];

// In the viewer's local time, as the tagger page has always compared it
const OG_SUPERTAGGER_BEFORE = new Date("December 26, 2022 00:00:00").getTime();

// Object.keys() types its result as string[]. The satisfies checks below
// make the keys of these records exactly K, so the cast is safe.
const keysOf = <K extends string>(record: Record<K, unknown>) =>
	Object.keys(record) as K[];

const TAG_KINDS = ["created", "updated", "deleted"] as const;
type TagKind = (typeof TAG_KINDS)[number];

// More tags of this kind than of each of the other two
const strictMajority = (stats: TaggerStats, kind: TagKind) =>
	TAG_KINDS.every((other) => other === kind || stats[kind] > stats[other]);

type AchievementRule = {
	icon: string;
	earned: (stats: TaggerStats) => boolean;
};

// Every achievement once, in the order the tagger page lists them
const ACHIEVEMENTS = {
	geyserTournament: {
		icon: "geyser",
		earned: ({ userId }) => GEYSER_TOURNAMENT_TAGGERS.includes(userId),
	},
	supporter: { icon: "supporter", earned: ({ supporter }) => supporter },
	topTagger: { icon: "top-tagger", earned: ({ rank }) => rank === 1 },
	podium: {
		icon: "podium",
		earned: ({ rank }) => rank !== null && rank <= 3,
	},
	highRank: {
		icon: "high-rank",
		earned: ({ rank }) => rank !== null && rank <= 10,
	},
	ogSupertagger: {
		icon: "og-supertagger",
		earned: ({ joinedAt }) => Date.parse(joinedAt) < OG_SUPERTAGGER_BEFORE,
	},
	lightningJunkie: {
		icon: "lightning-junkie",
		earned: ({ hasLightning }) => hasLightning,
	},
	helloWorld: { icon: "hello-world", earned: ({ hasAvatar }) => hasAvatar },
	creator: {
		icon: "creator",
		earned: (stats) => strictMajority(stats, "created"),
	},
	updateMaxi: {
		icon: "update-maxi",
		earned: (stats) => strictMajority(stats, "updated"),
	},
	demolitionSpecialist: {
		icon: "demolition-specialist",
		earned: (stats) => strictMajority(stats, "deleted"),
	},
} satisfies Record<Achievement["key"], AchievementRule>;

// /badges lists the achievements in its own order, Supporter first
const BADGES_PAGE_ORDER: Achievement["key"][] = [
	"supporter",
	"creator",
	"updateMaxi",
	"demolitionSpecialist",
	"helloWorld",
	"lightningJunkie",
	"ogSupertagger",
	"highRank",
	"podium",
	"topTagger",
	"geyserTournament",
];

type ContributionRule = { icon: string; minTags: number };

// Every contribution once, with the fewest tags that earn it
const CONTRIBUTIONS = {
	hyperbitcoinisation: { icon: "hyperbitcoinisation", minTags: 21000000 },
	pizzaTime: { icon: "pizza-time", minTags: 10000 },
	godly: { icon: "godly", minTags: 7777 },
	shadow: { icon: "shadow", minTags: 5000 },
	whitepaper: { icon: "whitepaper", minTags: 3110 },
	winston: { icon: "winston", minTags: 1984 },
	whale: { icon: "whale", minTags: 1000 },
	infinity: { icon: "infinity", minTags: 821 },
	legend: { icon: "legend", minTags: 500 },
	chancellor: { icon: "chancellor", minTags: 301 },
	sha: { icon: "sha", minTags: 256 },
	noBailouts: { icon: "no-bailouts", minTags: 210 },
	supertagger: { icon: "supertagger", minTags: 100 },
	ath: { icon: "ath", minTags: 69 },
	longestChain: { icon: "longest-chain", minTags: 51 },
	satoshi: { icon: "satoshi", minTags: 21 },
	heartbeat: { icon: "heartbeat", minTags: 10 },
	segwit: { icon: "segwit", minTags: 4 },
	wholeTagger: { icon: "whole-tagger", minTags: 1 },
} satisfies Record<Contribution["key"], ContributionRule>;

// Highest first: a tagger gets only the highest one reached
const CONTRIBUTIONS_HIGHEST_FIRST = keysOf(CONTRIBUTIONS).sort(
	(a, b) => CONTRIBUTIONS[b].minTags - CONTRIBUTIONS[a].minTags,
);

const achievement = (key: Achievement["key"]): Achievement => ({
	type: BadgeType.Achievement,
	key,
	icon: ACHIEVEMENTS[key].icon,
});

const contribution = (key: Contribution["key"]): Contribution => ({
	type: BadgeType.Contribution,
	key,
	icon: CONTRIBUTIONS[key].icon,
});

// What /badges shows, in its order: contributions from 1 tag up
export const BADGES_PAGE = {
	achievements: BADGES_PAGE_ORDER.map(achievement),
	contributions: [...CONTRIBUTIONS_HIGHEST_FIRST].reverse().map(contribution),
};

// The badge's title or description key in the locale files
export const badgeTextKey = (badge: EarnedBadge, text: "title" | "desc") =>
	`badges.${badge.type}.${badge.key}.${text}` as const;

// A tagger's place on the leaderboard, most tags first, null when not on
// it. sort() is stable, so taggers with the same total keep their order.
export const taggerRank = (
	leaderboard: ProfileLeaderboard[],
	userId: number,
): number | null => {
	const index = [...leaderboard]
		.sort((a, b) => b.total - a.total)
		.findIndex((entry) => entry.id === userId);
	return index === -1 ? null : index + 1;
};

// The badges a tagger earned, in the tagger page's order
export const taggerBadges = (stats: TaggerStats): EarnedBadge[] => {
	const total = stats.created + stats.updated + stats.deleted;
	const reached = CONTRIBUTIONS_HIGHEST_FIRST.find(
		(key) => total >= CONTRIBUTIONS[key].minTags,
	);

	return [
		...keysOf(ACHIEVEMENTS)
			.filter((key) => ACHIEVEMENTS[key].earned(stats))
			.map(achievement),
		...(reached ? [contribution(reached)] : []),
	];
};
