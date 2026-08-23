<script lang="ts">
import type { Map as MapLibreMap } from "maplibre-gl";

import { SEARCH_SHEET_PEEK_HEIGHT } from "$lib/drawerConfig";
import { _ } from "$lib/i18n";
import { buildAddLocationUrl } from "$lib/placementMode";

import { goto } from "$app/navigation";

export let map: MapLibreMap | undefined;
export let active = false;
export let isMobile = false;

// Keep ?add in the URL so placement mode is linkable. Same raw
// history.replaceState idiom as writeHashCoords ($lib/map/mapHash.ts),
// which preserves location.search on every viewport write — so ?add
// survives map moves and the hash survives this toggle. Other query
// params (e.g. ?issues) must be preserved, so edit, don't rebuild.
const syncUrl = () => {
	const params = new URLSearchParams(window.location.search);
	if (active) params.set("add", "");
	else params.delete("add");
	const query = params.toString() ? `?${params.toString()}` : "";
	history.replaceState(
		history.state,
		"",
		`${window.location.pathname}${query}${window.location.hash}`,
	);
};

const enter = () => {
	active = true;
	syncUrl();
};

const cancel = () => {
	active = false;
	syncUrl();
};

const confirm = () => {
	if (!map) return;
	const center = map.getCenter();
	goto(buildAddLocationUrl(center.lat, center.lng));
};
</script>

{#if active}
	<!-- center crosshair pin: tip must sit exactly on the map center,
	     so shift up by the full pin height -->
	<div
		class="pointer-events-none absolute left-1/2 top-1/2 z-[1001] -translate-x-1/2 -translate-y-full drop-shadow-lg"
	>
		<svg width="40" height="50" viewBox="0 0 24 30">
			<path
				d="M12 29s9-11.5 9-18A9 9 0 103 11c0 6.5 9 18 9 18z"
				fill="#F7931A"
				stroke="#fff"
				stroke-width="1.6"
			/>
			<circle cx="12" cy="11" r="4.6" fill="#fff" />
		</svg>
	</div>

	<div
		class="absolute bottom-0 left-0 right-0 z-[1002] rounded-t-2xl bg-white p-4 pb-6 shadow-lg dark:bg-dark"
	>
		<p class="text-lg font-semibold text-primary dark:text-white">
			{$_("map.placement.title")}
		</p>
		<p class="mt-1 text-sm text-body dark:text-offwhite">
			{$_("map.placement.hint")}
		</p>
		<div class="mt-4 flex gap-3">
			<button
				type="button"
				on:click={cancel}
				class="h-12 rounded-xl border border-input px-5 font-semibold text-body dark:text-offwhite"
			>
				{$_("map.placement.cancel")}
			</button>
			<button
				type="button"
				on:click={confirm}
				class="h-12 flex-1 rounded-xl bg-bitcoin font-semibold text-white hover:bg-bitcoinHover"
			>
				{$_("map.placement.confirm")}
			</button>
		</div>
	</div>
{:else}
	<!-- bottom-(--fab-bottom) + style var mirrors the IssueFilterChips
	     positioning idiom on this page; on mobile the FAB clears the
	     search sheet's peek, on desktop it sits near the bottom edge -->
	<button
		type="button"
		on:click={enter}
		class="bottom-(--fab-bottom) absolute left-3 z-[1000] flex h-12 items-center gap-2 rounded-full bg-bitcoin px-4 font-semibold text-white shadow-lg hover:bg-bitcoinHover"
		style="--fab-bottom: calc(env(safe-area-inset-bottom) + {isMobile
			? SEARCH_SHEET_PEEK_HEIGHT + 12
			: 24}px)"
	>
		<span class="text-xl leading-none">+</span>
		{$_("map.placement.fab")}
	</button>
{/if}
