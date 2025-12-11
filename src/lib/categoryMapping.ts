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

export const createEmptyCategoryCounts = (): CategoryCounts => {
	return CATEGORIES.reduce((acc, category) => {
		acc[category] = 0;
		return acc;
	}, {} as CategoryCounts);
};

export const countMerchantsByCategory = (merchants: Place[]): CategoryCounts => {
	const counts = createEmptyCategoryCounts();

	counts.all = merchants.length;

	// Build a reverse lookup map for icon -> category
	const iconToCategory = new Map<string, CategoryKey>();
	for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
		if (key === 'all') continue;
		for (const icon of group.icons) {
			iconToCategory.set(icon, key as CategoryKey);
		}
	}

	// Count merchants by category using the lookup map
	for (const merchant of merchants) {
		if (!merchant.icon) continue;
		const category = iconToCategory.get(merchant.icon);
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
