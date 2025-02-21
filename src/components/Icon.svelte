<script lang="ts">
	interface Props {
		w: string;
		h: string;
		style?: undefined | string;
		icon: string;
		type: 'apps' | 'material' | 'mobile-nav' | 'popup' | 'socials';
	}

	let {
		w,
		h,
		style = undefined,
		icon,
		type
	}: Props = $props();
</script>

<svg width="{w}px" height="{h}px" class={style}>
	<use width="{w}px" height="{h}px" href="/icons/{type}/spritesheet.svg#{icon}" />
</svg>
