import type { Place } from "$lib/types";

export type CategoryColor =
	| "orange"
	| "emerald"
	| "amber"
	| "blue"
	| "purple"
	| "yellow"
	| "";

export interface CategoryGroup {
	label: string;
	icons: readonly string[];
	color: CategoryColor;
}

export const CATEGORY_GROUPS: Record<string, CategoryGroup> = {
	all: {
		label: "All",
		icons: [],
		color: "",
	},
	restaurants: {
		label: "Restaurants",
		icons: ["restaurant", "local_pizza", "lunch_dining"],
		color: "orange",
	},
	shopping: {
		label: "Shopping",
		icons: ["storefront", "local_mall"],
		color: "emerald",
	},
	groceries: {
		label: "Groceries",
		icons: ["local_grocery_store"],
		color: "emerald",
	},
	coffee: {
		label: "Coffee",
		icons: ["local_cafe"],
		color: "amber",
	},
	atms: {
		label: "ATMs",
		icons: ["local_atm"],
		color: "yellow",
	},
	hotels: {
		label: "Hotels",
		icons: ["hotel"],
		color: "blue",
	},
	beauty: {
		label: "Beauty Salons",
		icons: ["content_cut"],
		color: "purple",
	},
};

export type CategoryKey =
	| "all"
	| "restaurants"
	| "shopping"
	| "groceries"
	| "coffee"
	| "atms"
	| "hotels"
	| "beauty";

// Explicit array for guaranteed order and clarity (could derive from CATEGORY_GROUPS but kept explicit)
export const CATEGORIES: readonly CategoryKey[] = [
	"all",
	"restaurants",
	"shopping",
	"groceries",
	"coffee",
	"atms",
	"hotels",
	"beauty",
] as const;

export const CATEGORY_ENTRIES = Object.entries(CATEGORY_GROUPS) as [
	CategoryKey,
	(typeof CATEGORY_GROUPS)[CategoryKey],
][];

export type CategoryCounts = Record<CategoryKey, number>;

// Build icon -> category lookup map once at module initialization
// (avoids rebuilding on every countMerchantsByCategory call during pan/zoom)
const ICON_TO_CATEGORY = new Map<string, CategoryKey>();
const ICON_TO_COLOR = new Map<string, CategoryColor>();

for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
	if (key === "all") continue;
	for (const icon of group.icons) {
		ICON_TO_CATEGORY.set(icon, key as CategoryKey);
		if (group.color) {
			ICON_TO_COLOR.set(icon, group.color);
		}
	}
}

export function getIconColor(icon: string | undefined): CategoryColor {
	if (!icon) return "";
	return ICON_TO_COLOR.get(icon) || "";
}

export const createEmptyCategoryCounts = (): CategoryCounts => {
	return CATEGORIES.reduce((acc, category) => {
		acc[category] = 0;
		return acc;
	}, {} as CategoryCounts);
};

export const countMerchantsByCategory = (
	merchants: Place[],
): CategoryCounts => {
	const counts = createEmptyCategoryCounts();

	counts.all = merchants.length;

	for (const merchant of merchants) {
		if (!merchant.icon) continue;
		const category = ICON_TO_CATEGORY.get(merchant.icon);
		if (category) {
			counts[category] += 1;
		}
	}

	return counts;
};

export const filterMerchantsByCategory = (
	merchants: Place[],
	category: CategoryKey,
): Place[] => {
	if (category === "all") return merchants;

	const categoryIcons = CATEGORY_GROUPS[category].icons;
	return merchants.filter((merchant) =>
		categoryIcons.some((icon) => merchant.icon === icon),
	);
};

// Check if a single place matches a category (used for map marker filtering)
export const placeMatchesCategory = (
	place: Place,
	category: CategoryKey,
): boolean => {
	if (category === "all") return true;
	if (!place.icon) return false;
	return ICON_TO_CATEGORY.get(place.icon) === category;
};
