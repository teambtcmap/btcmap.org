import type { Place } from '$lib/types';

export const CATEGORY_GROUPS = {
	all: {
		label: 'All',
		icons: [] as string[]
	},
	restaurants: {
		label: 'Restaurants',
		icons: ['restaurant', 'local_pizza', 'lunch_dining']
	},
	shopping: {
		label: 'Shopping',
		icons: ['storefront', 'local_mall']
	},
	groceries: {
		label: 'Groceries',
		icons: ['local_grocery_store']
	},
	coffee: {
		label: 'Coffee',
		icons: ['local_cafe']
	},
	atms: {
		label: 'ATMs',
		icons: ['local_atm']
	},
	hotels: {
		label: 'Hotels',
		icons: ['hotel']
	},
	beauty: {
		label: 'Beauty Salons',
		icons: ['content_cut']
	}
} as const;

export type CategoryKey = keyof typeof CATEGORY_GROUPS;

// Explicit array for guaranteed order and clarity (could derive from CATEGORY_GROUPS but kept explicit)
export const CATEGORIES: readonly CategoryKey[] = [
	'all',
	'restaurants',
	'shopping',
	'groceries',
	'coffee',
	'atms',
	'hotels',
	'beauty'
] as const;

export const CATEGORY_ENTRIES = Object.entries(CATEGORY_GROUPS) as [
	CategoryKey,
	(typeof CATEGORY_GROUPS)[CategoryKey]
][];

export type CategoryCounts = Record<CategoryKey, number>;

// Build icon -> category lookup map once at module initialization
// (avoids rebuilding on every countMerchantsByCategory call during pan/zoom)
const ICON_TO_CATEGORY = new Map<string, CategoryKey>();
for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
	if (key === 'all') continue;
	for (const icon of group.icons) {
		ICON_TO_CATEGORY.set(icon, key as CategoryKey);
	}
}

export const createEmptyCategoryCounts = (): CategoryCounts => {
	return CATEGORIES.reduce((acc, category) => {
		acc[category] = 0;
		return acc;
	}, {} as CategoryCounts);
};

export const countMerchantsByCategory = (merchants: Place[]): CategoryCounts => {
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

export const filterMerchantsByCategory = (merchants: Place[], category: CategoryKey): Place[] => {
	if (category === 'all') return merchants;

	const categoryIcons = CATEGORY_GROUPS[category].icons;
	return merchants.filter((merchant) => categoryIcons.some((icon) => merchant.icon === icon));
};

// Check if a single place matches a category (used for map marker filtering)
export const placeMatchesCategory = (place: Place, category: CategoryKey): boolean => {
	if (category === 'all') return true;
	if (!place.icon) return false;
	const categoryIcons = CATEGORY_GROUPS[category].icons as readonly string[];
	return categoryIcons.includes(place.icon);
};
