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

export const CATEGORIES = Object.keys(CATEGORY_GROUPS) as CategoryKey[];

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

	for (const merchant of merchants) {
		if (!merchant.icon) continue;

		for (const category of CATEGORIES) {
			if (category === 'all') continue;
			const categoryIcons = CATEGORY_GROUPS[category].icons;
			if (categoryIcons.some((icon) => merchant.icon === icon)) {
				counts[category] += 1;
			}
		}
	}

	return counts;
};

export const filterMerchantsByCategory = (merchants: Place[], category: CategoryKey): Place[] => {
	if (category === 'all') return merchants;

	const categoryIcons = CATEGORY_GROUPS[category].icons;
	return merchants.filter((merchant) => categoryIcons.some((icon) => merchant.icon === icon));
};
