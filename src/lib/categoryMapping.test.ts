import { describe, expect, it } from "vitest";

import type { Place } from "$lib/types";

import {
	CATEGORIES,
	CATEGORY_ENTRIES,
	CATEGORY_GROUPS,
	type CategoryKey,
	countMerchantsByCategory,
	createEmptyCategoryCounts,
	filterMerchantsByCategory,
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
		it('should have "all" category with empty icons array', () => {
			expect(CATEGORY_GROUPS.all.icons).toEqual([]);
			expect(CATEGORY_GROUPS.all.label).toBe("All");
		});

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

		it('should have "all" as the first category', () => {
			expect(CATEGORIES[0]).toBe("all");
		});
	});

	describe("CATEGORY_ENTRIES", () => {
		it("should have correctly typed entries", () => {
			expect(CATEGORY_ENTRIES.length).toBe(Object.keys(CATEGORY_GROUPS).length);
			for (const [key, value] of CATEGORY_ENTRIES) {
				expect(CATEGORY_GROUPS[key]).toBe(value);
			}
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

		it('should count "all" as total merchants', () => {
			const merchants = [
				createMockPlace({ icon: "restaurant" }),
				createMockPlace({ icon: "local_cafe" }),
				createMockPlace({ icon: "unknown_icon" }),
			];

			const counts = countMerchantsByCategory(merchants);

			expect(counts.all).toBe(3);
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

		it("should handle multiple icons mapping to same category", () => {
			const merchants = [
				createMockPlace({ icon: "storefront" }), // shopping
				createMockPlace({ icon: "local_mall" }), // also shopping
			];

			const counts = countMerchantsByCategory(merchants);

			expect(counts.shopping).toBe(2);
		});
	});

	describe("filterMerchantsByCategory", () => {
		const merchants = [
			createMockPlace({ id: 1, icon: "restaurant" }),
			createMockPlace({ id: 2, icon: "local_pizza" }),
			createMockPlace({ id: 3, icon: "local_cafe" }),
			createMockPlace({ id: 4, icon: "storefront" }),
			createMockPlace({ id: 5, icon: "unknown" }),
			createMockPlace({ id: 6 }), // no icon
		];

		it('should return all merchants for "all" category', () => {
			const filtered = filterMerchantsByCategory(merchants, "all");

			expect(filtered).toBe(merchants); // Same reference
			expect(filtered.length).toBe(6);
		});

		it("should filter restaurants correctly", () => {
			const filtered = filterMerchantsByCategory(merchants, "restaurants");

			expect(filtered.length).toBe(2);
			expect(filtered.map((m) => m.id)).toEqual([1, 2]);
		});

		it("should filter coffee correctly", () => {
			const filtered = filterMerchantsByCategory(merchants, "coffee");

			expect(filtered.length).toBe(1);
			expect(filtered[0].id).toBe(3);
		});

		it("should filter shopping correctly", () => {
			const filtered = filterMerchantsByCategory(merchants, "shopping");

			expect(filtered.length).toBe(1);
			expect(filtered[0].id).toBe(4);
		});

		it("should return empty array when no matches", () => {
			const filtered = filterMerchantsByCategory(merchants, "atms");

			expect(filtered).toEqual([]);
		});

		it("should return empty array for empty input", () => {
			const filtered = filterMerchantsByCategory([], "restaurants");

			expect(filtered).toEqual([]);
		});

		it("should not modify original array", () => {
			const original = [...merchants];
			filterMerchantsByCategory(merchants, "restaurants");

			expect(merchants).toEqual(original);
		});

		it("should filter correctly for each category", () => {
			const testMerchants = [
				createMockPlace({ icon: "restaurant" }),
				createMockPlace({ icon: "local_pizza" }),
				createMockPlace({ icon: "lunch_dining" }),
				createMockPlace({ icon: "storefront" }),
				createMockPlace({ icon: "local_mall" }),
				createMockPlace({ icon: "local_grocery_store" }),
				createMockPlace({ icon: "local_cafe" }),
				createMockPlace({ icon: "local_atm" }),
				createMockPlace({ icon: "hotel" }),
				createMockPlace({ icon: "content_cut" }),
			];

			const categoryTests: [CategoryKey, number][] = [
				["all", 10],
				["restaurants", 3],
				["shopping", 2],
				["groceries", 1],
				["coffee", 1],
				["atms", 1],
				["hotels", 1],
				["beauty", 1],
			];

			for (const [category, expectedCount] of categoryTests) {
				const filtered = filterMerchantsByCategory(testMerchants, category);
				expect(filtered.length).toBe(expectedCount);
			}
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
});
