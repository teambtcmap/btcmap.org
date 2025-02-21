<script lang="ts">
	import { LoadingSpinner } from '$lib/comp';

	interface Props {
		text: string;
		style: string;
		link?: undefined | string;
		click?: undefined | ((p?: any) => void);
		type?: undefined | 'button' | 'submit';
		external?: undefined | boolean;
		disabled?: undefined | boolean;
		loading?: undefined | boolean;
	}

	let {
		text,
		style,
		link = undefined,
		click = undefined,
		type = undefined,
		external = undefined,
		disabled = undefined,
		loading = undefined
	}: Props = $props();
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
		onclick={click}
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
