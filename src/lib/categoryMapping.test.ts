import { describe, expect, it } from "vitest";

import type { Place } from "#lib/types.js";

import type { CategoryKey } from "./categoryMapping";
import {
	CATEGORIES,
	CATEGORY_ENTRIES,
	CATEGORY_GROUPS,
	countMerchantsByCategory,
	createEmptyCategoryCounts,
	getIconColor,
	getIconColorWithFallback,
	placeMatchesCategory,
} from "./categoryMapping";

// Helper to create mock Place objects with specific icons
function createMockPlace(overrides: Partial<Place> = {}): Place {
	return {
		id: Math.floor(Math.random() * 10000),
		lat: 0,
		lon: 0,
		name: "Test Place",
		...overrides,
	} as Place;
}

describe("categoryMapping", () => {
	describe("CATEGORY_GROUPS", () => {
		it("should have expected categories", () => {
			const expectedCategories = [
				"all",
				"restaurants",
				"shopping",
				"groceries",
				"coffee",
				"atms",
				"hotels",
				"beauty",
			];
			expect(Object.keys(CATEGORY_GROUPS)).toEqual(expectedCategories);
		});

		it('should have non-empty icons for all categories except "all"', () => {
			for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
				if (key === "all") {
					expect(group.icons).toEqual([]);
				} else {
					expect(group.icons.length).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("CATEGORIES", () => {
		it("should match CATEGORY_GROUPS keys in order", () => {
			expect(CATEGORIES).toEqual(Object.keys(CATEGORY_GROUPS));
		});
	});

	describe("createEmptyCategoryCounts", () => {
		it("should return counts object with all categories set to 0", () => {
			const counts = createEmptyCategoryCounts();

			for (const category of CATEGORIES) {
				expect(counts[category]).toBe(0);
			}
		});

		it("should return a new object each time", () => {
			const counts1 = createEmptyCategoryCounts();
			const counts2 = createEmptyCategoryCounts();

			expect(counts1).not.toBe(counts2);
		});
	});

	describe("countMerchantsByCategory", () => {
		it("should return empty counts for empty array", () => {
			const counts = countMerchantsByCategory([]);

			expect(counts.all).toBe(0);
			for (const category of CATEGORIES) {
				expect(counts[category]).toBe(0);
			}
		});

		it("should count restaurants correctly", () => {
			const merchants = [
				createMockPlace({ icon: "restaurant" }),
				createMockPlace({ icon: "local_pizza" }),
				createMockPlace({ icon: "lunch_dining" }),
				createMockPlace({ icon: "local_cafe" }), // coffee, not restaurant
			];

			const counts = countMerchantsByCategory(merchants);

			expect(counts.restaurants).toBe(3);
			expect(counts.coffee).toBe(1);
		});

		it("should count all category types", () => {
			const merchants = [
				createMockPlace({ icon: "restaurant" }), // restaurants
				createMockPlace({ icon: "storefront" }), // shopping
				createMockPlace({ icon: "local_grocery_store" }), // groceries
				createMockPlace({ icon: "local_cafe" }), // coffee
				createMockPlace({ icon: "local_atm" }), // atms
				createMockPlace({ icon: "hotel" }), // hotels
				createMockPlace({ icon: "content_cut" }), // beauty
			];

			const counts = countMerchantsByCategory(merchants);

			expect(counts.all).toBe(7);
			expect(counts.restaurants).toBe(1);
			expect(counts.shopping).toBe(1);
			expect(counts.groceries).toBe(1);
			expect(counts.coffee).toBe(1);
			expect(counts.atms).toBe(1);
			expect(counts.hotels).toBe(1);
			expect(counts.beauty).toBe(1);
		});

		it("should handle merchants without icons", () => {
			const merchants = [
				createMockPlace({ icon: "restaurant" }),
				createMockPlace({ icon: undefined }),
				createMockPlace({}), // no icon property
			];

			const counts = countMerchantsByCategory(merchants);

			expect(counts.all).toBe(3);
			expect(counts.restaurants).toBe(1);
		});

		it("should handle merchants with unknown icons", () => {
			const merchants = [
				createMockPlace({ icon: "unknown_icon_1" }),
				createMockPlace({ icon: "unknown_icon_2" }),
				createMockPlace({ icon: "restaurant" }),
			];

			const counts = countMerchantsByCategory(merchants);

			expect(counts.all).toBe(3);
			expect(counts.restaurants).toBe(1);
			// Unknown icons shouldn't be counted in any specific category
			const sumOfCategories = CATEGORIES.filter((c) => c !== "all").reduce(
				(sum, cat) => sum + counts[cat],
				0,
			);
			expect(sumOfCategories).toBe(1);
		});
	});

	describe("placeMatchesCategory", () => {
		it('should return true for "all" category regardless of icon', () => {
			expect(
				placeMatchesCategory(createMockPlace({ icon: "restaurant" }), "all"),
			).toBe(true);
			expect(
				placeMatchesCategory(createMockPlace({ icon: "unknown" }), "all"),
			).toBe(true);
			expect(placeMatchesCategory(createMockPlace({}), "all")).toBe(true);
		});

		it('should return false for places without icons (except "all")', () => {
			expect(placeMatchesCategory(createMockPlace({}), "restaurants")).toBe(
				false,
			);
			expect(
				placeMatchesCategory(createMockPlace({ icon: undefined }), "coffee"),
			).toBe(false);
		});

		it("should correctly match restaurant icons", () => {
			expect(
				placeMatchesCategory(
					createMockPlace({ icon: "restaurant" }),
					"restaurants",
				),
			).toBe(true);
			expect(
				placeMatchesCategory(
					createMockPlace({ icon: "local_pizza" }),
					"restaurants",
				),
			).toBe(true);
			expect(
				placeMatchesCategory(
					createMockPlace({ icon: "lunch_dining" }),
					"restaurants",
				),
			).toBe(true);
			expect(
				placeMatchesCategory(
					createMockPlace({ icon: "local_cafe" }),
					"restaurants",
				),
			).toBe(false);
		});

		it("should correctly match each category", () => {
			const categoryIconTests: [CategoryKey, string, boolean][] = [
				["shopping", "storefront", true],
				["shopping", "local_mall", true],
				["shopping", "restaurant", false],
				["groceries", "local_grocery_store", true],
				["groceries", "storefront", false],
				["coffee", "local_cafe", true],
				["coffee", "restaurant", false],
				["atms", "local_atm", true],
				["atms", "hotel", false],
				["hotels", "hotel", true],
				["hotels", "local_atm", false],
				["beauty", "content_cut", true],
				["beauty", "restaurant", false],
			];

			for (const [category, icon, expected] of categoryIconTests) {
				expect(placeMatchesCategory(createMockPlace({ icon }), category)).toBe(
					expected,
				);
			}
		});

		it("should return false for unknown icons in specific categories", () => {
			expect(
				placeMatchesCategory(
					createMockPlace({ icon: "unknown_icon" }),
					"restaurants",
				),
			).toBe(false);
			expect(
				placeMatchesCategory(createMockPlace({ icon: "random" }), "coffee"),
			).toBe(false);
		});
	});

	describe("getIconColor", () => {
		it("should return the correct color for a known icon", () => {
			expect(getIconColor("restaurant")).toBe("orange");
			expect(getIconColor("local_pizza")).toBe("orange");
			expect(getIconColor("local_cafe")).toBe("amber");
			expect(getIconColor("local_atm")).toBe("yellow");
			expect(getIconColor("hotel")).toBe("blue");
			expect(getIconColor("content_cut")).toBe("purple");
			expect(getIconColor("storefront")).toBe("emerald");
			expect(getIconColor("local_grocery_store")).toBe("emerald");
		});

		it("should return empty string for an unknown icon", () => {
			expect(getIconColor("unknown_icon")).toBe("");
			expect(getIconColor("currency_bitcoin")).toBe("");
		});

		it("should return empty string for undefined", () => {
			expect(getIconColor(undefined)).toBe("");
		});
	});

	describe("getIconColorWithFallback", () => {
		it("should return the mapped color for a known icon", () => {
			expect(getIconColorWithFallback("restaurant")).toBe("orange");
			expect(getIconColorWithFallback("local_cafe")).toBe("amber");
			expect(getIconColorWithFallback("local_atm")).toBe("yellow");
		});

		it("should return empty string for undefined", () => {
			expect(getIconColorWithFallback(undefined)).toBe("");
		});

		it("should return a deterministic fallback color for an unknown icon", () => {
			// charCodeAt(0) of 'c' (99) => 99 % 6 = 3 => 'purple'
			expect(getIconColorWithFallback("currency_bitcoin")).toBe("purple");
			// charCodeAt(0) of 'u' (117) => 117 % 6 = 3 => 'purple'
			expect(getIconColorWithFallback("unknown_icon")).toBe("purple");
		});
	});

	// Chip counts (countMerchantsByCategory) and the places a chip selects
	// (placeMatchesCategory) must agree for every configured icon, or the chips
	// promise places the map then hides (the #1159 bug class).
	describe("category predicate equivalence", () => {
		// Every mapped icon, plus the shapes callers actually see: unknown,
		// empty, and missing icons.
		const corpus: Place[] = [
			...CATEGORY_ENTRIES.flatMap(([, group]) =>
				group.icons.map((icon) => createMockPlace({ icon })),
			),
			createMockPlace({ icon: "some_unknown_icon" }),
			createMockPlace({ icon: "" }),
			createMockPlace({}),
		];

		it("every icon belongs to exactly one category group", () => {
			const seen = new Map<string, CategoryKey>();
			for (const [key, group] of CATEGORY_ENTRIES) {
				for (const icon of group.icons) {
					const previous = seen.get(icon);
					// The icon→category lookup is last-write-wins: an icon listed in
					// two groups silently drops out of the earlier one.
					expect(
						previous,
						previous === key
							? `icon "${icon}" is listed twice in group "${key}" — remove the duplicate`
							: `icon "${icon}" is in both "${previous}" and "${key}" — only "${key}" will ever match it`,
					).toBeUndefined();
					seen.set(icon, key);
				}
			}
		});

		it("countMerchantsByCategory agrees with placeMatchesCategory for every category", () => {
			const counts = countMerchantsByCategory(corpus);
			for (const category of CATEGORIES) {
				expect(counts[category], `category "${category}"`).toBe(
					corpus.filter((p) => placeMatchesCategory(p, category)).length,
				);
			}
		});
	});
});
