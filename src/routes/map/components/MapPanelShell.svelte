<script lang="ts">
import type { Snippet } from "svelte";
import { fly } from "svelte/transition";

import { MAP_PANEL_MARGIN, MERCHANT_DRAWER_WIDTH } from "$lib/constants";

import { browser } from "$app/environment";

// The map's one panel-card definition: desktop floating card (drawer
// sizing, max-height leaving the attribution corner uncovered, fly-in,
// sticky header) — full-screen sheet below md for hosts that render
// there. MerchantDrawerDesktop and AddPlaceFormPanel both wear it; a
// consumer supplies the header row and body as snippets and keeps its
// own behavior (focus, keys, history).
type Props = {
	label: string;
	role?: "dialog";
	// Desktop left offset in px — the drawer animates it with the list
	// panel; static hosts take the default margin.
	left?: number;
	// A nested view (the drawer's boost screen) underlines the header.
	headerBorder?: boolean;
	element?: HTMLElement;
	header: Snippet;
	children: Snippet;
};
let {
	label,
	role,
	left = MAP_PANEL_MARGIN,
	headerBorder = false,
	element = $bindable(),
	header,
	children,
}: Props = $props();

// Mount-time is fine: a mid-session viewport-class change would only
// soften the entry animation, nothing else. Both consumers instantiate
// the shell client-side only today, but the browser guard keeps a
// future SSR-rendered consumer from throwing here — transitions don't
// run on the server anyway.
const desktop = browser && window.matchMedia("(min-width: 768px)").matches;
</script>

<section
	bind:this={element}
	aria-label={label}
	{role}
	in:fly={desktop
		? { x: -MERCHANT_DRAWER_WIDTH, duration: 300 }
		: { y: 200, duration: 300 }}
	class="absolute inset-0 z-[1002] overflow-y-auto bg-white md:inset-auto md:top-3 md:left-(--panel-left) md:max-h-[calc(100%-0.75rem-max(3rem,env(safe-area-inset-bottom)))] md:w-full md:max-w-(--panel-w) md:rounded-lg md:shadow-lg md:transition-[left] md:duration-200 dark:bg-dark"
	style="--panel-left: {left}px; --panel-w: {MERCHANT_DRAWER_WIDTH}px"
>
	<div
		class="sticky top-0 z-10 flex items-center justify-between rounded-t-lg bg-white p-2 dark:bg-dark {headerBorder
			? 'border-b border-gray-300 dark:border-white/95'
			: ''}"
	>
		{@render header()}
	</div>

	{@render children()}
</section>
