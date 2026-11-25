import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { TaggerStats } from "./badges";
import { BADGES_PAGE, badgeTextKey, taggerBadges } from "./badges";
import en from "./i18n/locales/en.json";
import { BadgeType } from "./types";

// A tagger who earns nothing until a test says otherwise
const tagger = (stats: Partial<TaggerStats> = {}): TaggerStats => ({
	userId: 1,
	joinedAt: "2024-06-01T00:00:00.000Z",
	supporter: false,
	hasAvatar: false,
	hasLightning: false,
	rank: null,
	created: 0,
	updated: 0,
	deleted: 0,
	...stats,
});

const keysOf = (stats: Partial<TaggerStats>, type: BadgeType) =>
	taggerBadges(tagger(stats))
		.filter((badge) => badge.type === type)
		.map((badge) => badge.key);

const contributionKeys = (total: number) =>
	keysOf({ created: total }, BadgeType.Contribution);

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
				keysOf({ created: 2, updated: 1, deleted: 1 }, BadgeType.Contribution),
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
			[null, []],
		] as const)("gives place %s in the top 10: %j", (rank, keys) => {
			expect(keysOf({ rank }, BadgeType.Achievement)).toEqual(keys);
		});

		it.each([
			[{ created: 3, updated: 1, deleted: 1 }, ["creator"]],
			[{ created: 1, updated: 3, deleted: 1 }, ["updateMaxi"]],
			[{ created: 1, updated: 1, deleted: 3 }, ["demolitionSpecialist"]],
			[{ created: 2, updated: 2, deleted: 1 }, []],
			[{ created: 1, updated: 2, deleted: 2 }, []],
			[{ created: 2, updated: 1, deleted: 2 }, []],
		])("gives a badge only for a strict majority: %j", (tags, keys) => {
			expect(keysOf(tags, BadgeType.Achievement)).toEqual(keys);
		});

		it("gives OG Supertagger to taggers who joined before 26 December 2022", () => {
			expect(
				keysOf({ joinedAt: "2022-06-01T00:00:00.000Z" }, BadgeType.Achievement),
			).toEqual(["ogSupertagger"]);
			expect(
				keysOf({ joinedAt: "2023-06-01T00:00:00.000Z" }, BadgeType.Achievement),
			).toEqual([]);
		});

		it.each([
			[{ supporter: true }, ["supporter"]],
			[{ hasAvatar: true }, ["helloWorld"]],
			[{ hasLightning: true }, ["lightningJunkie"]],
			[{ userId: 10396321 }, ["geyserTournament"]],
		])("gives %j: %j", (stats, keys) => {
			expect(keysOf(stats, BadgeType.Achievement)).toEqual(keys);
		});
	});

	it("lists the badges in the tagger page's order, the contribution last", () => {
		const badges = taggerBadges(
			tagger({
				userId: 10396321,
				joinedAt: "2022-06-01T00:00:00.000Z",
				supporter: true,
				hasAvatar: true,
				hasLightning: true,
				rank: 1,
				created: 10,
			}),
		);

		expect(badges).toEqual([
			{ type: BadgeType.Achievement, key: "geyserTournament", icon: "geyser" },
			{ type: BadgeType.Achievement, key: "supporter", icon: "supporter" },
			{ type: BadgeType.Achievement, key: "topTagger", icon: "top-tagger" },
			{ type: BadgeType.Achievement, key: "podium", icon: "podium" },
			{ type: BadgeType.Achievement, key: "highRank", icon: "high-rank" },
			{
				type: BadgeType.Achievement,
				key: "ogSupertagger",
				icon: "og-supertagger",
			},
			{
				type: BadgeType.Achievement,
				key: "lightningJunkie",
				icon: "lightning-junkie",
			},
			{ type: BadgeType.Achievement, key: "helloWorld", icon: "hello-world" },
			{ type: BadgeType.Achievement, key: "creator", icon: "creator" },
			{ type: BadgeType.Contribution, key: "heartbeat", icon: "heartbeat" },
		]);
	});
});

describe("BADGES_PAGE", () => {
	it("shows the achievements in its own order, Supporter first", () => {
		expect(BADGES_PAGE.achievements.map((badge) => badge.key)).toEqual([
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

	it("shows the contributions from 1 tag up", () => {
		expect(BADGES_PAGE.contributions.map((badge) => badge.key)).toEqual(
			THRESHOLDS.map(([, key]) => key),
		);
	});

	it("has every badge of the locale files once, each with an icon file", () => {
		const badges = [...BADGES_PAGE.achievements, ...BADGES_PAGE.contributions];

		expect(BADGES_PAGE.achievements.map((badge) => badge.key).sort()).toEqual(
			Object.keys(en.badges.achievement).sort(),
		);
		expect(BADGES_PAGE.contributions.map((badge) => badge.key).sort()).toEqual(
			Object.keys(en.badges.contribution).sort(),
		);
		// Vitest runs from the project root
		for (const { icon } of badges) {
			expect(existsSync(`static/icons/badges/${icon}.svg`), icon).toBe(true);
		}
	});
});

describe("badgeTextKey", () => {
	it("names the title and the description in the locale files", () => {
		const satoshi = { type: BadgeType.Contribution, key: "satoshi" } as const;

		expect(badgeTextKey(satoshi, "title")).toBe(
			"badges.contribution.satoshi.title",
		);
		expect(badgeTextKey(satoshi, "desc")).toBe(
			"badges.contribution.satoshi.desc",
		);
	});
});
