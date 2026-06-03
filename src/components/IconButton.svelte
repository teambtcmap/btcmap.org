<script lang="ts">
export let style: string = "";
export let link: undefined | string = undefined;
export let type: undefined | "button" | "submit" = undefined;
export let external: undefined | boolean = undefined;
export let disabled: undefined | boolean = undefined;

const baseStyles =
	"rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10";

$: combinedStyles = style ? `${baseStyles} ${style}` : baseStyles;
</script>

{#if link}
	<a
		href={link}
		target={external ? '_blank' : undefined}
		rel={external ? 'noopener noreferrer' : undefined}
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
