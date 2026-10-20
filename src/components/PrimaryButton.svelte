<script lang="ts">
import type { Snippet } from "svelte";

import LoadingSpinner from "$components/LoadingSpinner.svelte";

type Props = {
	style: string;
	link?: string;
	type?: "button" | "submit";
	external?: boolean;
	disabled?: boolean;
	loading?: boolean;
	onclick?: (event: MouseEvent) => void;
	children?: Snippet;
	[key: string]: unknown;
};
let {
	style,
	link,
	type,
	external,
	disabled,
	loading,
	onclick,
	children,
	...rest
}: Props = $props();

const baseStyles =
	"block bg-link text-center font-semibold text-white hover:bg-hover transition-colors";

const combinedStyles = $derived(`${baseStyles} ${style}`);
</script>

{#if link}
	<a
		href={link}
		target={external ? '_blank' : undefined}
		rel={external ? 'noopener noreferrer' : undefined}
		class={combinedStyles}
		{onclick}
		{...rest}
	>
		{@render children?.()}
	</a>
{:else}
	<button {onclick} {type} {disabled} class={combinedStyles} {...rest}>
		{#if loading}
			<LoadingSpinner />
		{:else}
			{@render children?.()}
		{/if}
	</button>
{/if}
