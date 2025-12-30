<script lang="ts">
	import { merchantList } from '$lib/merchantListStore';
	import Icon from '$components/Icon.svelte';
	import { trackEvent } from '$lib/analytics';
	import { MERCHANT_LIST_MAX_ITEMS } from '$lib/constants';

	// Callback when search is used (opens panel)
	export let onSearch: ((query: string) => void) | undefined = undefined;
	export let onFocus: (() => void) | undefined = undefined;
	export let onNearbyClick: (() => void) | undefined = undefined;
	export let nearbyCount = 0;
	export let isLoadingCount = false;

	// Format count: hide when 0, show ">99" when exceeds max
	$: formattedCount =
		nearbyCount === 0
			? ''
			: nearbyCount > MERCHANT_LIST_MAX_ITEMS
				? `(>${MERCHANT_LIST_MAX_ITEMS})`
				: `(${nearbyCount})`;

	let inputElement: HTMLInputElement;

	// Store subscriptions
	$: searchQuery = $merchantList.searchQuery;
	$: mode = $merchantList.mode;
	$: isSearching = $merchantList.isSearching;
	$: isOpen = $merchantList.isOpen;

	// Placeholder based on mode
	$: placeholder = mode === 'search' ? 'Search worldwide...' : 'Search nearby...';

	function handleInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		merchantList.setSearchQuery(value);
		// Stay in current mode - no auto-switch
		onSearch?.(value);
	}

	function handleModeSwitch(newMode: 'nearby' | 'search') {
		if (newMode === mode) return;
		trackEvent(newMode === 'nearby' ? 'searchbar_nearby_click' : 'searchbar_worldwide_click');
		merchantList.setMode(newMode);
		// Open panel when clicking Nearby tab if there are results
		if (newMode === 'nearby' && nearbyCount > 0) {
			onNearbyClick?.();
		}
	}

	function handleFocus() {
		onFocus?.();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (searchQuery) {
				e.preventDefault();
				handleClear();
			} else {
				inputElement?.blur();
			}
		}
	}

	function handleClear() {
		merchantList.clearSearchInput();
		merchantList.exitSearchMode();
		onSearch?.('');
		inputElement?.focus();
	}

	// Allow parent to focus the input
	export function focus() {
		inputElement?.focus();
	}
</script>

<!-- Floating search bar - hidden when panel is open (panel has its own search in same position) -->
{#if !isOpen}
	<div class="pointer-events-auto flex w-80 flex-col gap-2">
		<!-- Search input -->
		<div
			class="rounded-lg bg-white shadow-lg dark:bg-dark dark:shadow-black/30"
			style="filter: drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.15));"
		>
			<div class="relative">
				<Icon
					w="18"
					h="18"
					icon="search"
					type="material"
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-white/50"
				/>
				<input
					bind:this={inputElement}
					value={searchQuery}
					on:input={handleInput}
					on:focus={handleFocus}
					on:keydown={handleKeyDown}
					type="search"
					{placeholder}
					aria-label="Search for Bitcoin merchants"
					class="w-full rounded-lg border-0 bg-transparent py-3 pr-10 pl-10 text-sm text-primary outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/50 [&::-webkit-search-cancel-button]:hidden"
				/>
				{#if searchQuery}
					<button
						type="button"
						on:click={handleClear}
						class="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white"
						aria-label="Clear search"
					>
						<Icon w="16" h="16" icon="close" type="material" />
					</button>
				{:else if isSearching}
					<div class="absolute top-1/2 right-3 -translate-y-1/2">
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-link dark:border-white/30 dark:border-t-white"
						></div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Segmented tabs (order matches panel: Worldwide, Nearby) -->
		<div class="flex gap-1.5">
			<button
				type="button"
				on:click={() => handleModeSwitch('search')}
				class="rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors
					{mode === 'search'
					? 'bg-link text-white'
					: 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark dark:text-white/70 dark:hover:bg-white/10'}"
				style="filter: drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.1));"
			>
				Worldwide
			</button>
			<button
				type="button"
				on:click={() => handleModeSwitch('nearby')}
				class="rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors
					{mode === 'nearby'
					? 'bg-link text-white'
					: 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark dark:text-white/70 dark:hover:bg-white/10'}"
				style="filter: drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.1));"
			>
				Nearby{#if isLoadingCount}<span class="opacity-60"> ...</span>{:else if formattedCount}
					{formattedCount}{/if}
			</button>
		</div>
	</div>
{/if}
