<script lang="ts">
	import type { MerchantListMode } from '$lib/merchantListStore';
	import { merchantList } from '$lib/merchantListStore';
	import Icon from '$components/Icon.svelte';
	import { trackEvent } from '$lib/analytics';
	import { formatNearbyCount } from '$lib/utils';

	// Callback when search is used (opens panel)
	export let onSearch: ((query: string) => void) | undefined = undefined;
	export let onFocus: (() => void) | undefined = undefined;
	export let onNearbyClick: (() => void) | undefined = undefined;
	export let nearbyCount = 0;
	export let isLoadingCount = false;

	$: formattedCount = formatNearbyCount(nearbyCount);

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

	function handleModeSwitch(newMode: MerchantListMode) {
		const isSameMode = newMode === mode;
		if (!isSameMode) {
			trackEvent(newMode === 'nearby' ? 'searchbar_nearby_click' : 'searchbar_worldwide_click');
			merchantList.setMode(newMode);
		}
		// Always open panel when clicking Nearby tab (shows guidance if empty)
		if (newMode === 'nearby') {
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
	<div class="pointer-events-auto flex w-full flex-col-reverse gap-2 md:w-80 md:flex-col">
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
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-600 dark:text-white/70"
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
						class="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-gray-600 hover:text-gray-800 dark:text-white/70 dark:hover:text-white"
						aria-label="Clear search"
					>
						<Icon w="16" h="16" icon="close" type="material" />
					</button>
				{:else if isSearching}
					<div
						class="absolute top-1/2 right-3 -translate-y-1/2"
						role="status"
						aria-label="Searching"
					>
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-link dark:border-white/30 dark:border-t-white"
						></div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Segmented tabs (order matches panel: Worldwide, Nearby) -->
		<div class="flex gap-1.5 md:gap-1.5" role="radiogroup" aria-label="Search mode">
			<button
				type="button"
				role="radio"
				aria-checked={mode === 'search'}
				on:click={() => handleModeSwitch('search')}
				class="rounded-full px-4 py-2.5 text-sm font-medium shadow-sm transition-colors md:px-3 md:py-1.5 md:text-xs
					{mode === 'search'
					? 'bg-link text-white'
					: 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark dark:text-white/70 dark:hover:bg-white/10'}"
				style="filter: drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.1));"
			>
				Worldwide
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={mode === 'nearby'}
				on:click={() => handleModeSwitch('nearby')}
				class="rounded-full px-4 py-2.5 text-sm font-medium shadow-sm transition-colors md:px-3 md:py-1.5 md:text-xs
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
