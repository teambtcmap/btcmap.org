<script lang="ts">
	import type { AppIconName } from './types';
	import android from './apps/android.svg?raw';
	import fdroid from './apps/f-droid.svg?raw';
	import ios from './apps/ios.svg?raw';
	import play from './apps/play.svg?raw';
	import web from './apps/web.svg?raw';

	const icons: Record<AppIconName, string> = {
		android,
		'f-droid': fdroid,
		ios,
		play,
		web
	};

	export let icon: AppIconName;
	export let w = '24';
	export let h = '24';
	let className: string | undefined = undefined;
	export { className as class };
</script>

<span
	class={className}
	style="display: block; width: {w}px; height: {h}px;"
	role="img"
	aria-hidden="true"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags - SVG from trusted local files -->
	{@html icons[icon]}
</span>

<style>
	span :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
