<script lang="ts">
	import { LoadingSpinner } from '$lib/comp';

	export let text: string;
	export let style: string;
	export let link: undefined | string = undefined;
	export let click: undefined | ((p?: any) => void) = undefined;
	export let type: undefined | 'button' | 'submit' = undefined;
	export let external: undefined | boolean = undefined;
	export let disabled: undefined | boolean = undefined;
	export let loading: undefined | boolean = undefined;
</script>

{#if link}
	<a
		href={link}
		target={external ? '_blank' : null}
		rel={external ? 'noreferrer' : null}
		class="block bg-link text-center font-semibold text-white hover:bg-hover {style} transition-colors"
	>
		{text}
	</a>
{:else}
	<button
		on:click={click}
		{type}
		{disabled}
		class="block bg-link text-center font-semibold text-white hover:bg-hover {style} transition-colors"
	>
		{#if loading}
			<LoadingSpinner />
		{:else}
			{text}
		{/if}
	</button>
{/if}
