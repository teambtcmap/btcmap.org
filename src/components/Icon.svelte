<script lang="ts">
	export let w: string;
	export let h: string;
	export let style: undefined | string = undefined;
	export let icon: string;
</script>

<svg width="{w}px" height="{h}px" class={style}>
	<use width="{w}px" height="{h}px" href="/__spritemap#sprite-{icon}" />
</svg>
