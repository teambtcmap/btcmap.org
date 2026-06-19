<script lang="ts">
import Icon from "$components/Icon.svelte";

export let value: string = "";
export let placeholder: string = "";
export let ariaLabel: string = "Search";
export let rounded: boolean = false;
// Filled-field variant: gives the input a grey rounded surface so it reads
// clearly as a tappable search field (used inside the merchant list panel)
export let filled: boolean = false;

let inputElement: HTMLInputElement;

export function focus() {
	inputElement?.focus();
}
</script>

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
		{value}
		on:input
		on:focus
		on:keydown
		type="search"
		{placeholder}
		aria-label={ariaLabel}
		class="w-full border-0 py-3 pr-10 pl-10 text-base text-primary outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/50 [&::-webkit-search-cancel-button]:hidden
			{rounded ? 'rounded-lg' : ''}
			{filled ? 'rounded-xl bg-gray-100 dark:bg-white/5' : 'bg-transparent'}"
	/>
	<!-- pointer-events-none so passive content (count pill, spinner) doesn't
	     block taps on the input underneath; interactive slotted buttons must
	     re-enable with pointer-events-auto -->
	<div class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
		<slot name="trailing" />
	</div>
</div>
