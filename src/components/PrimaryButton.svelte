<script lang="ts">
	import { LoadingSpinner } from '$lib/comp';

	export let style: string;
	export let link: undefined | string = undefined;
	export let type: undefined | 'button' | 'submit' = undefined;
	export let external: undefined | boolean = undefined;
	export let disabled: undefined | boolean = undefined;
	export let loading: undefined | boolean = undefined;

	const baseStyles =
		'block bg-link text-center font-semibold text-white hover:bg-hover transition-colors';

	$: combinedStyles = `${baseStyles} ${style}`;
</script>

{#if link}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a
		href={link}
		target={external ? '_blank' : undefined}
		rel={external ? 'noreferrer' : undefined}
		class={combinedStyles}
	>
		<slot />
	</a>
{:else}
	<button on:click {type} {disabled} class={combinedStyles}>
		{#if loading}
			<LoadingSpinner />
		{:else}
			<slot />
		{/if}
	</button>
{/if}
