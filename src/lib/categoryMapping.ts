import type { Place } from "$lib/types";

export type CategoryColor =
	| "orange"
	| "emerald"
	| "amber"
	| "blue"
	| "purple"
	| "yellow"
	| "pink"
	| "cyan"
	| "";

export type CategoryGroup = {
	label: string;
	icons: readonly string[];
	color: CategoryColor;
};

export const CATEGORY_GROUPS = {
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
} satisfies Record<string, CategoryGroup>;

export type CategoryKey = keyof typeof CATEGORY_GROUPS;

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

const FALLBACK_COLORS: CategoryColor[] = [
	"emerald",
	"amber",
	"blue",
	"purple",
	"pink",
	"cyan",
];

export function getIconColorWithFallback(
	icon: string | undefined,
): CategoryColor {
	const mappedColor = getIconColor(icon);
	if (mappedColor) return mappedColor;
	if (!icon) return "";
	return FALLBACK_COLORS[icon.charCodeAt(0) % FALLBACK_COLORS.length];
}

export const CATEGORY_COLOR_CLASSES: Record<CategoryColor, string> = {
	orange:
		"bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
	emerald:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
	amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
	blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
	purple:
		"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
	pink: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
	cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
	yellow:
		"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
	"": "",
};

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
