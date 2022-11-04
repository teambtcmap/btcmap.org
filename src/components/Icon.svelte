<script>
	export let width;
	export let height;
	export let style;
	export let icon;
	export let type;
</script>

<svg width="{width}px" height="{height}px" class={style}>
	<use width="{width}px" height="{height}px" href="/icons/{type}/spritesheet.svg#{icon}" />
</svg>
