<script lang="ts">
import Icon from "$components/Icon.svelte";

export let value: string = "";
export let placeholder: string = "";
export let ariaLabel: string = "Search";
export let rounded: boolean = false;

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
		class="w-full border-0 bg-transparent py-3 pr-10 pl-10 text-sm text-primary outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/50 [&::-webkit-search-cancel-button]:hidden
			{rounded ? 'rounded-lg' : ''}"
	/>
	<div class="absolute top-1/2 right-3 -translate-y-1/2">
		<slot name="trailing" />
	</div>
</div>
