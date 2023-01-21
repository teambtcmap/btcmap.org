<script>
	export let w;
	export let h;
	export let style = undefined;
	export let icon;
	export let type;
</script>

<svg width="{w}px" height="{h}px" class={style}>
	<use width="{w}px" height="{h}px" href="/icons/{type}/spritesheet.svg#{icon}" />
</svg>
