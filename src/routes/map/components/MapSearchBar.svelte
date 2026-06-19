<script lang="ts">
import Icon from "$components/Icon.svelte";
import SearchInput from "$components/SearchInput.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { merchantList } from "$lib/merchantListStore";
import { formatNearbyPillCount } from "$lib/utils";

import NearbyCountPill from "./NearbyCountPill.svelte";

// Callback when search is used (opens panel)
export let onSearch: ((query: string) => void) | undefined = undefined;
export let onFocus: (() => void) | undefined = undefined;
export let nearbyCount = 0;

let searchInputComponent: SearchInput;

// Store subscriptions
$: searchQuery = $merchantList.searchQuery;
$: isOpen = $merchantList.isOpen;

// Count rides a pill inside the input while at rest; it disappears as soon
// as the user types (the clear button takes the slot)
$: pillCount = formatNearbyPillCount(nearbyCount);

function handleInput(e: Event) {
	const value = (e.target as HTMLInputElement).value;
	merchantList.setSearchQuery(value);
	// Stay in current mode - no auto-switch
	onSearch?.(value);
}

function handleFocus() {
	trackEvent("search_input_focus", { source: "floating_bar" });
	onFocus?.();
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		if (searchQuery) {
			e.preventDefault();
			handleClear();
		}
	} else if (e.key === "Enter") {
		e.preventDefault();
		onSearch?.(searchQuery);
	}
}

function handleClear() {
	merchantList.clearSearchInput();
	onSearch?.("");
	searchInputComponent?.focus();
}
</script>

<!-- Floating search bar - hidden when panel is open (panel has its own search in same position).
     Single input, no scope toggle: an empty box browses nearby, typing searches worldwide. -->
{#if !isOpen}
	<div class="pointer-events-auto w-full md:w-80">
		<div class="rounded-lg bg-white shadow-lg dark:bg-dark dark:shadow-black/30">
			<SearchInput
				bind:this={searchInputComponent}
				value={searchQuery}
				placeholder={$_('search.placeholderPlaces')}
				ariaLabel={$_('aria.searchInput')}
				rounded
				on:input={handleInput}
				on:focus={handleFocus}
				on:keydown={handleKeyDown}
			>
				<svelte:fragment slot="trailing">
					{#if searchQuery}
						<button
							type="button"
							on:click={handleClear}
							class="pointer-events-auto p-1 text-gray-600 hover:text-gray-800 dark:text-white/70 dark:hover:text-white"
							aria-label={$_('aria.clearSearch')}
						>
							<Icon w="20" h="20" icon="close" type="material" />
						</button>
					{:else if pillCount}
						<NearbyCountPill count={pillCount} />
					{/if}
				</svelte:fragment>
			</SearchInput>
		</div>
	</div>
{/if}
