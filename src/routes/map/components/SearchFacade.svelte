<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";

import NearbyCountPill from "./NearbyCountPill.svelte";

// Pre-formatted nearby count from formatNearbyPillCount; "" hides the pill
export let count: string = "";

// Only the surface differs between placements: a floating card on desktop, a
// row inside the sheet's peek state on mobile.
let className = "";

export { className as class };

// The sheet drives its swipe gestures from this node and restores focus to it
// when it collapses, so the consumer needs the element itself.
export let element: HTMLButtonElement | undefined = undefined;

// Desktop bar and mobile sheet are mutually exclusive, so exactly one facade is
// ever mounted and a static id needs no uniqueness plumbing.
const COUNT_DESCRIPTION_ID = "search-facade-nearby-count";
</script>

<!-- A button, never an input: activating the facade unmounts it (the panel
     renders the real search input in its place), so an input here could never
     receive a keystroke — and on mobile it would raise the on-screen keyboard. -->
<button
	bind:this={element}
	type="button"
	aria-expanded="false"
	aria-describedby={count ? COUNT_DESCRIPTION_ID : undefined}
	class="relative flex w-full items-center pl-10 text-left {className}"
	on:click
	on:pointerdown
	on:pointermove
	on:pointerup
	on:pointercancel
>
	<Icon
		w="18"
		h="18"
		icon="search"
		type="material"
		class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-600 dark:text-white/70"
	/>
	<span class="flex-1 truncate text-base text-gray-400 dark:text-white/50">
		{$_('search.placeholderPlaces')}
	</span>
	{#if count}
		<!-- Hidden from the a11y tree so the button's accessible name stays
		     "Search places..." — a name that shifted with the nearby count would
		     break voice control, which selects elements by the name it announces.
		     The count still reaches screen readers via the description below. -->
		<NearbyCountPill {count} decorative />
	{/if}
</button>
{#if count}
	<span id={COUNT_DESCRIPTION_ID} class="sr-only">
		{$_('search.nearbyCount', { values: { count } })}
	</span>
{/if}
