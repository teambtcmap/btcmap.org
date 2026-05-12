<script lang="ts">
export let style: string = "";
export let link: undefined | string = undefined;
export let type: undefined | "button" | "submit" = undefined;
export let external: undefined | boolean = undefined;
export let disabled: undefined | boolean = undefined;

const baseStyles = "text-link transition-colors hover:text-hover";

$: combinedStyles = style ? `${baseStyles} ${style}` : baseStyles;
</script>

{#if link}
	<a
		href={link}
		target={external ? '_blank' : undefined}
		rel={external ? 'noreferrer' : undefined}
		on:click
		class={combinedStyles}
		{...$$restProps}
	>
		<slot />
	</a>
{:else}
	<button on:click {type} {disabled} class={combinedStyles} {...$$restProps}>
		<slot />
	</button>
{/if}
