import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import en from "#lib/i18n/locales/en.json";
import type { EarnedBadge, EventType } from "#lib/types.js";
import { BadgeType } from "#lib/types.js";

import type { BadgeInputs } from "./badges";
import {
	BADGE_CATALOG,
	badgeTextKey,
	isSupporter,
	lightningAddress,
	tagCounts,
	taggerBadges,
	taggerLeaderboard,
	taggerRank,
} from "./badges";

// A tagger who earns nothing until a test says otherwise
const tagger = (inputs: Partial<BadgeInputs> = {}): BadgeInputs => ({
	userId: 1,
	joinedAt: "2024-06-01T00:00:00.000Z",
	supporter: false,
	hasAvatar: false,
	hasLightning: false,
	rank: null,
	created: 0,
	updated: 0,
	deleted: 0,
	...inputs,
});

const earnedKeys = (inputs: Partial<BadgeInputs>, type: BadgeType) =>
	taggerBadges(tagger(inputs))
		.filter((badge) => badge.type === type)
		.map((badge) => badge.key);

const contributionKeys = (total: number) =>
	earnedKeys({ created: total }, BadgeType.Contribution);

// [fewest tags, badge], lowest first
const THRESHOLDS = [
	[1, "wholeTagger"],
	[4, "segwit"],
	[10, "heartbeat"],
	[21, "satoshi"],
	[51, "longestChain"],
	[69, "ath"],
	[100, "supertagger"],
	[210, "noBailouts"],
	[256, "sha"],
	[301, "chancellor"],
	[500, "legend"],
	[821, "infinity"],
	[1000, "whale"],
	[1984, "winston"],
	[3110, "whitepaper"],
	[5000, "shadow"],
	[7777, "godly"],
	[10000, "pizzaTime"],
	[21000000, "hyperbitcoinisation"],
] as const;

// The icon of every badge, as the files in static/icons/badges are named
const ICONS = {
	geyserTournament: "geyser",
	supporter: "supporter",
	topTagger: "top-tagger",
	podium: "podium",
	highRank: "high-rank",
	ogSupertagger: "og-supertagger",
	lightningJunkie: "lightning-junkie",
	helloWorld: "hello-world",
	creator: "creator",
	updateMaxi: "update-maxi",
	demolitionSpecialist: "demolition-specialist",
	hyperbitcoinisation: "hyperbitcoinisation",
	pizzaTime: "pizza-time",
	godly: "godly",
	shadow: "shadow",
	whitepaper: "whitepaper",
	winston: "winston",
	whale: "whale",
	infinity: "infinity",
	legend: "legend",
	chancellor: "chancellor",
	sha: "sha",
	noBailouts: "no-bailouts",
	supertagger: "supertagger",
	ath: "ath",
	longestChain: "longest-chain",
	satoshi: "satoshi",
	heartbeat: "heartbeat",
	segwit: "segwit",
	wholeTagger: "whole-tagger",
} satisfies Record<EarnedBadge["key"], string>;

describe("taggerBadges", () => {
	describe("contribution badge", () => {
		it("gives none without tags", () => {
			expect(contributionKeys(0)).toEqual([]);
		});

		it.each(THRESHOLDS)("gives it from %i tags: %s", (min, key) => {
			expect(contributionKeys(min)).toEqual([key]);
		});

		it.each(
			THRESHOLDS.slice(1).map(
				([min], i) => [min - 1, THRESHOLDS[i][1]] as const,
			),
		)("still gives the one below at %i tags: %s", (total, key) => {
			expect(contributionKeys(total)).toEqual([key]);
		});

		it("counts created, updated and deleted tags together", () => {
			expect(
				earnedKeys(
					{ created: 2, updated: 1, deleted: 1 },
					BadgeType.Contribution,
				),
			).toEqual(["segwit"]);
		});
	});

	describe("achievements", () => {
		it.each([
			[1, ["topTagger", "podium", "highRank"]],
			[2, ["podium", "highRank"]],
			[3, ["podium", "highRank"]],
			[4, ["highRank"]],
			[10, ["highRank"]],
			[11, []],
			[null, []],
		] as const)("gives place %s on the leaderboard: %j", (rank, keys) => {
			expect(earnedKeys({ rank }, BadgeType.Achievement)).toEqual(keys);
		});

		it.each([
			[{ created: 3, updated: 1, deleted: 1 }, ["creator"]],
			[{ created: 1, updated: 3, deleted: 1 }, ["updateMaxi"]],
			[{ created: 1, updated: 1, deleted: 3 }, ["demolitionSpecialist"]],
			[{ created: 2, updated: 2, deleted: 1 }, []],
			[{ created: 1, updated: 2, deleted: 2 }, []],
			[{ created: 2, updated: 1, deleted: 2 }, []],
		])("gives a badge only for a strict majority: %j", (tags, keys) => {
			expect(earnedKeys(tags, BadgeType.Achievement)).toEqual(keys);
		});

		it("gives OG Supertagger to taggers who joined before 26 December 2022, local time", () => {
			// The cutoff the tagger page has always used, in the viewer's time zone
			const cutoff = new Date("December 26, 2022 00:00:00").getTime();
			const earnedIfJoinedAt = (time: number) =>
				earnedKeys(
					{ joinedAt: new Date(time).toISOString() },
					BadgeType.Achievement,
				);

			expect(earnedIfJoinedAt(cutoff - 1)).toEqual(["ogSupertagger"]);
			expect(earnedIfJoinedAt(cutoff)).toEqual([]);
		});

		it.each([
			[{ supporter: true }, ["supporter"]],
			[{ hasAvatar: true }, ["helloWorld"]],
			[{ hasLightning: true }, ["lightningJunkie"]],
			[{ userId: 10396321 }, ["geyserTournament"]],
		])("gives %j: %j", (inputs, keys) => {
			expect(earnedKeys(inputs, BadgeType.Achievement)).toEqual(keys);
		});
	});

	// Earns every achievement but the three for a majority
	const decorated = {
		userId: 10396321,
		joinedAt: "2022-06-01T00:00:00.000Z",
		supporter: true,
		hasAvatar: true,
		hasLightning: true,
		rank: 1,
	};

	it.each([
		[{ created: 10 }, "creator"],
		[{ updated: 10 }, "updateMaxi"],
		[{ deleted: 10 }, "demolitionSpecialist"],
	] as const)(
		"lists the badges in the tagger page's order, the contribution last: %j",
		(tags, majority) => {
			const badges = taggerBadges(tagger({ ...decorated, ...tags }));

			expect(badges.map((badge) => badge.key)).toEqual([
				"geyserTournament",
				"supporter",
				"topTagger",
				"podium",
				"highRank",
				"ogSupertagger",
				"lightningJunkie",
				"helloWorld",
				majority,
				"heartbeat",
			]);
			expect(badges.map((badge) => badge.type)).toEqual([
				...Array.from({ length: 9 }, () => BadgeType.Achievement),
				BadgeType.Contribution,
			]);
		},
	);
});

describe("taggerRank", () => {
	// Tagger 1 has the most tags, tagger 12 the fewest
	const leaderboard = Array.from({ length: 12 }, (_, i) => ({
		id: i + 1,
		total: 100 - i,
	}));

	it("gives the place on the leaderboard", () => {
		expect(taggerRank(leaderboard, 1)).toBe(1);
		expect(taggerRank(leaderboard, 11)).toBe(11);
	});

	it("sorts the leaderboard itself, most tags first", () => {
		const unsorted = [...leaderboard].reverse();

		expect(taggerRank(unsorted, 1)).toBe(1);
		expect(taggerRank(unsorted, 11)).toBe(11);
		expect(unsorted).toEqual([...leaderboard].reverse());
	});

	it("keeps the leaderboard's order for the same number of tags", () => {
		const tied = [
			{ id: 5, total: 10 },
			{ id: 3, total: 20 },
			{ id: 7, total: 10 },
		];

		expect(taggerRank(tied, 3)).toBe(1);
		expect(taggerRank(tied, 5)).toBe(2);
		expect(taggerRank(tied, 7)).toBe(3);
	});

	it("gives null to a tagger who is not on it", () => {
		expect(taggerRank(leaderboard, 99)).toBeNull();
		expect(taggerRank([], 1)).toBeNull();
	});
});

describe("isSupporter", () => {
	const now = Date.parse("2026-06-01T00:00:00.000Z");

	it.each([
		["2026-06-01T00:00:00.001Z", true],
		["2099-01-01T00:00:00.000Z", true],
		["2026-06-01T00:00:00.000Z", false],
		["2026-05-31T23:59:59.999Z", false],
		["", false],
		["not a date", false],
	])("gives supporter:expires %j: %s", (expires, expected) => {
		expect(isSupporter({ "supporter:expires": expires }, now)).toBe(expected);
	});

	it("gives false without supporter:expires", () => {
		expect(isSupporter({}, now)).toBe(false);
	});
});

describe("lightningAddress", () => {
	it.each([
		["Hi [⚡](lightning:sats@example.com)", "sats@example.com"],
		["Tips: lightning:sats@example.com", "sats@example.com"],
		["[⚡](lightning:)", null],
		["No tips here", null],
	])("finds the address in %j: %j", (description, expected) => {
		expect(lightningAddress(description)).toBe(expected);
	});
});

const events = (userId: number, type: EventType, count: number) =>
	Array.from({ length: count }, () => ({ user_id: userId, type }));

describe("tagCounts", () => {
	const all = [
		...events(1, "create", 3),
		...events(2, "create", 5),
		...events(1, "update", 2),
		...events(1, "delete", 1),
		...events(17221642, "delete", 1),
	];

	it("counts the tagger's own events by type", () => {
		expect(tagCounts(all, 1)).toEqual({ created: 3, updated: 2, deleted: 1 });
		expect(tagCounts(all, 99)).toEqual({ created: 0, updated: 0, deleted: 0 });
	});

	it("gives 17221642 100 extra created and 20 extra updated tags", () => {
		expect(tagCounts(all, 17221642)).toEqual({
			created: 100,
			updated: 20,
			deleted: 1,
		});
	});
});

describe("taggerLeaderboard", () => {
	it("lists the users with events in the users' order, with all their events", () => {
		const users = [{ id: 3 }, { id: 2 }, { id: 1 }];
		const all = [
			...events(1, "create", 2),
			...events(2, "update", 1),
			...events(1, "delete", 1),
			...events(99, "create", 5),
		];

		expect(taggerLeaderboard(users, all)).toEqual([
			{ id: 2, total: 1 },
			{ id: 1, total: 3 },
		]);
	});

	it("gives 17221642 120 extra tags, only when they have events", () => {
		const users = [{ id: 17221642 }];

		expect(taggerLeaderboard(users, events(17221642, "create", 1))).toEqual([
			{ id: 17221642, total: 121 },
		]);
		expect(taggerLeaderboard(users, [])).toEqual([]);
	});
});

describe("BADGE_CATALOG", () => {
	const allBadges = [
		...BADGE_CATALOG.achievements,
		...BADGE_CATALOG.contributions,
	];

	it("lists the achievements in the /badges order, Supporter first", () => {
		expect(BADGE_CATALOG.achievements.map((badge) => badge.key)).toEqual([
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
		]);
	});

	it("lists the contributions from 1 tag up", () => {
		expect(BADGE_CATALOG.contributions.map((badge) => badge.key)).toEqual(
			THRESHOLDS.map(([, key]) => key),
		);
	});

	it("gives every badge its own icon", () => {
		expect(
			Object.fromEntries(allBadges.map((badge) => [badge.key, badge.icon])),
		).toEqual(ICONS);
	});

	it("has every badge of the locale files once, each with an icon file", () => {
		expect(BADGE_CATALOG.achievements.map((badge) => badge.key).sort()).toEqual(
			Object.keys(en.badges.achievement).sort(),
		);
		expect(
			BADGE_CATALOG.contributions.map((badge) => badge.key).sort(),
		).toEqual(Object.keys(en.badges.contribution).sort());
		// Vitest runs from the project root
		for (const { icon } of allBadges) {
			expect(existsSync(`static/icons/badges/${icon}.svg`), icon).toBe(true);
		}
	});
});

describe("badgeTextKey", () => {
	it.each([
		{
			badge: { type: BadgeType.Achievement, key: "creator", icon: "creator" },
			title: "badges.achievement.creator.title",
			desc: "badges.achievement.creator.desc",
		},
		{
			badge: { type: BadgeType.Contribution, key: "satoshi", icon: "satoshi" },
			title: "badges.contribution.satoshi.title",
			desc: "badges.contribution.satoshi.desc",
		},
	] as const)(
		"names the title and the description of $badge.key in the locale files",
		({ badge, title, desc }) => {
			expect(badgeTextKey(badge, "title")).toBe(title);
			expect(badgeTextKey(badge, "desc")).toBe(desc);
		},
	);

	it("takes only a key of the badge's own type", () => {
		const mixedUp = {
			type: BadgeType.Contribution,
			key: "creator",
			icon: "creator",
		} as const;

		// @ts-expect-error: creator is an achievement, not a contribution
		badgeTextKey(mixedUp, "title");
	});
});
