<script lang="ts">
	import { LoadingSpinner } from '$lib/comp';

	export let style: string;
	export let link: undefined | string = undefined;
	export let type: undefined | 'button' | 'submit' = undefined;
	export let external: undefined | boolean = undefined;
	export let disabled: undefined | boolean = undefined;
	export let loading: undefined | boolean = undefined;
</script>

{#if link}
	<a
		href={link}
		target={external ? '_blank' : undefined}
		rel={external ? 'noreferrer' : undefined}
		class="block bg-link text-center font-semibold text-white hover:bg-hover {style} transition-colors"
	>
		<slot />
	</a>
{:else}
	<button
		on:click
		{type}
		{disabled}
		class="block bg-link text-center font-semibold text-white hover:bg-hover {style} transition-colors"
	>
		{#if loading}
			<LoadingSpinner />
		{:else}
			<slot />
		{/if}
	</button>
{/if}
