<script lang="ts">
	import IconIconify from '@iconify/svelte';

	export let w: string;
	export let h: string;
	export let style: undefined | string = undefined;
	export let icon: string;
	export let type: undefined | 'material' = undefined;

	// Format material icon name to work with IconIconify
	$: formattedIcon = type === 'material' ? `ic:outline-${icon.replace(/_/g, '-')}` : icon;
</script>

{#if type === 'material'}
	<IconIconify icon={formattedIcon} width={w} height={h} class={style} />
{:else}
	<svg width="{w}px" height="{h}px" class={style}>
		<use width="{w}px" height="{h}px" href="/__spritemap#sprite-{icon}" />
	</svg>
{/if}
