<script lang="ts">
	import { merchantList } from '$lib/merchantListStore';
	import { CATEGORY_ENTRIES } from '$lib/categoryMapping';
	import { MERCHANT_LIST_LOW_ZOOM } from '$lib/constants';

	export let zoomLevel: number;
	export let activeCategory: string = 'all';

	type CategoryKey =
		| 'all'
		| 'restaurants'
		| 'shopping'
		| 'groceries'
		| 'coffee'
		| 'atms'
		| 'hotels'
		| 'beauty';

	// Show filters only when zoomed in enough to show nearby places
	$: shouldShowFilters = zoomLevel >= MERCHANT_LIST_LOW_ZOOM;

	function handleCategoryClick(category: string) {
		const categoryKey = category as CategoryKey;
		merchantList.setSelectedCategory(categoryKey === activeCategory ? 'all' : categoryKey);
	}

	function getCategoryButtonClass(key: string, selectedCategory: string): string {
		if (selectedCategory === key) return 'bg-link text-white';
		return 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark dark:text-white/70 dark:hover:bg-white/10';
	}
</script>

{#if shouldShowFilters}
	<div class="map-category-filters" role="radiogroup" aria-label="Filter by category">
		<h3 class="sr-only">Filter by category</h3>
		<div class="flex flex-nowrap gap-1.5 whitespace-nowrap md:gap-1.5">
			{#each CATEGORY_ENTRIES as [key, category] (key)}
				<button
					type="button"
					role="radio"
					on:click={() => handleCategoryClick(key)}
					aria-checked={activeCategory === key}
					class="rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-sm transition-colors {getCategoryButtonClass(
						key,
						activeCategory
					)}"
				>
					{category.label}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.map-category-filters {
		display: flex;
		align-items: center;
		z-index: 1000;
	}

	@media (max-width: 1024px) {
		.map-category-filters {
			display: none !important;
		}
	}
</style>
