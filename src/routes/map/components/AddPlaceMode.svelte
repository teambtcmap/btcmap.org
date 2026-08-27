<script lang="ts">
import type {
	LngLatLike,
	Map as MapLibreMap,
	MapMouseEvent,
} from "maplibre-gl";
import { tick } from "svelte";

import PlacementPinIcon from "$components/PlacementPinIcon.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { NearbyPlace } from "$lib/placementMode";
import {
	buildAddLocationUrl,
	fetchNearbyPlaceNames,
	findNearbyPlaces,
} from "$lib/placementMode";
import { places } from "$lib/store";

import { goto } from "$app/navigation";

type Props = {
	map: MapLibreMap | undefined;
	active?: boolean;
};

let { map, active = $bindable(false) }: Props = $props();

// Raw (non-deep-proxying) state: `nearby` is always reassigned wholesale
// (never mutated in place), and the confirm() identity guard below relies on
// `nearby === hits` holding after a plain assignment — $state would wrap the
// array in a new proxy on assignment, breaking that reference check.
let nearby: NearbyPlace[] | null = $state.raw(null);

// Symmetric focus management for the confirm<->interrupt swap: whichever
// button unmounts, the surviving sheet's equivalent button takes focus
// instead of it falling back to <body>.
let backButtonEl: HTMLButtonElement | undefined = $state();
let confirmButtonEl: HTMLButtonElement | undefined = $state();

// Keep ?add in the URL so placement mode is linkable. Same raw
// history.replaceState idiom as writeHashCoords ($lib/map/mapHash.ts),
// which preserves location.search on every viewport write — so ?add
// survives map moves and the hash survives this toggle. Other query
// params (e.g. ?issues) must be preserved, so edit, don't rebuild.
// Runs as an effect (reading `active` tracks it) so external activation —
// the page flipping bind:active from the menu entry — syncs too.
$effect(() => {
	const params = new URLSearchParams(window.location.search);
	if (active) params.set("add", "");
	else params.delete("add");
	const query = params.toString() ? `?${params.toString()}` : "";
	history.replaceState(
		history.state,
		"",
		`${window.location.pathname}${query}${window.location.hash}`,
	);
});

const enter = (method: string) => {
	active = true;
	trackEvent("add_place_enter", { method });
};

const cancel = () => {
	nearby = null;
	active = false;
};

// add_place_confirm keeps meaning "handed off to the form" — it fires on
// both the direct path and the add-anyway path, so the funnel metric is
// unchanged by the interrupt.
const navigateToForm = (lat: number, long: number) => {
	trackEvent("add_place_confirm");
	goto(buildAddLocationUrl(lat, long));
};

const confirm = async () => {
	if (!map) return;
	const center = map.getCenter();
	const hits = findNearbyPlaces(center.lat, center.lng, $places);
	if (hits.length === 0) {
		navigateToForm(center.lat, center.lng);
		return;
	}
	nearby = hits;
	trackEvent("add_place_nearby_shown", { count: hits.length });
	await tick();
	backButtonEl?.focus();

	const names = await fetchNearbyPlaceNames(center.lat, center.lng);
	// Identity guard: Back, Cancel, a map move, or a newer confirm all
	// replace/clear `nearby` — never patch a list the user left.
	if (nearby !== hits || names.size === 0) return;
	nearby = hits.map((hit) =>
		names.has(hit.place.id)
			? { ...hit, place: { ...hit.place, name: names.get(hit.place.id) } }
			: hit,
	);
};

const addAnyway = () => {
	if (!map) return;
	const center = map.getCenter();
	trackEvent("add_place_nearby_continue");
	navigateToForm(center.lat, center.lng);
};

const backToConfirm = async () => {
	nearby = null;
	await tick();
	confirmButtonEl?.focus();
};

// Long-press (touch) and right-click (desktop) both jump straight into
// placement mode centered on the pressed/clicked point — they still land on
// the confirm sheet rather than skipping it, so an accidental trigger is
// always recoverable via Cancel.
const enterAt = (lngLat: LngLatLike, method: string) => {
	if (!map || active) return;
	map.easeTo({ center: lngLat, duration: 300 });
	enter(method);
};

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

$effect(() => {
	if (!map) return;

	const currentMap = map;
	const canvas = currentMap.getCanvas();

	let longPressTimer: ReturnType<typeof setTimeout> | undefined;
	let touchStart: { x: number; y: number } | null = null;

	const clearLongPress = () => {
		if (longPressTimer !== undefined) {
			clearTimeout(longPressTimer);
			longPressTimer = undefined;
		}
		touchStart = null;
	};

	const onTouchStart = (e: TouchEvent) => {
		// A second finger means pinch/rotate, not a long press.
		if (e.touches.length > 1) {
			clearLongPress();
			return;
		}
		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		touchStart = { x: touch.clientX, y: touch.clientY };
		longPressTimer = setTimeout(() => {
			if (!touchStart) return;
			const rect = canvas.getBoundingClientRect();
			const point = currentMap.unproject([
				touchStart.x - rect.left,
				touchStart.y - rect.top,
			]);
			clearLongPress();
			enterAt(point, "long_press");
		}, LONG_PRESS_MS);
	};

	// Panning cancels the hold — only a stationary press counts.
	const onTouchMove = (e: TouchEvent) => {
		if (!touchStart) return;
		const touch = e.touches[0];
		if (!touch) return;
		const dx = touch.clientX - touchStart.x;
		const dy = touch.clientY - touchStart.y;
		if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) clearLongPress();
	};

	const onTouchEnd = () => clearLongPress();

	// Android fires a native contextmenu around the same long-press
	// threshold as our manual timer; clearing it here stops the timer from
	// also firing and double-entering placement mode. iOS Safari fires no
	// contextmenu on long-press, which is what the manual timer is for.
	const onContextMenu = (e: MapMouseEvent) => {
		clearLongPress();
		if (active) return;
		e.originalEvent.preventDefault();
		enterAt(e.lngLat, "right_click");
	};

	canvas.addEventListener("touchstart", onTouchStart, { passive: true });
	canvas.addEventListener("touchmove", onTouchMove, { passive: true });
	canvas.addEventListener("touchend", onTouchEnd);
	canvas.addEventListener("touchcancel", onTouchEnd);
	currentMap.on("contextmenu", onContextMenu);

	return () => {
		clearLongPress();
		canvas.removeEventListener("touchstart", onTouchStart);
		canvas.removeEventListener("touchmove", onTouchMove);
		canvas.removeEventListener("touchend", onTouchEnd);
		canvas.removeEventListener("touchcancel", onTouchEnd);
		currentMap.off("contextmenu", onContextMenu);
	};
});

// Moving the map moves the pin, so a shown candidate list is stale —
// drop back to the confirm sheet.
$effect(() => {
	if (!map || nearby === null) return;
	const currentMap = map;
	const onMoveStart = () => {
		nearby = null;
	};
	currentMap.on("movestart", onMoveStart);
	return () => {
		currentMap.off("movestart", onMoveStart);
	};
});
</script>

{#if active}
	<!-- center crosshair pin: tip must sit exactly on the map center,
	     so shift up by the full pin height -->
	<div
		class="pointer-events-none absolute left-1/2 top-1/2 z-[1001] -translate-x-1/2 -translate-y-full drop-shadow-lg"
	>
		<PlacementPinIcon width={40} />
	</div>

	<div
		class="absolute bottom-0 left-0 right-0 z-[1002] rounded-t-2xl bg-white p-4 pb-6 shadow-lg dark:bg-dark"
	>
		{#if nearby === null}
			<p class="text-lg font-semibold text-primary dark:text-white">
				{$_("map.placement.title")}
			</p>
			<p class="mt-1 text-sm text-body dark:text-offwhite">
				{$_("map.placement.hint")}
			</p>
			<div class="mt-4 flex gap-3">
				<button
					type="button"
					onclick={cancel}
					class="h-12 rounded-xl border border-input px-5 font-semibold text-body dark:text-offwhite"
				>
					{$_("map.placement.cancel")}
				</button>
				<button
					bind:this={confirmButtonEl}
					type="button"
					onclick={confirm}
					class="h-12 flex-1 rounded-xl bg-bitcoin font-semibold text-white hover:bg-bitcoinHover"
				>
					{$_("map.placement.confirm")}
				</button>
			</div>
		{:else}
			<p class="text-lg font-semibold text-primary dark:text-white">
				{$_("map.placement.nearbyTitle")}
			</p>
			<p class="mt-1 text-sm text-body dark:text-offwhite">
				{$_("map.placement.nearbyHint")}
			</p>
			<ul class="mt-3 max-h-40 space-y-1 overflow-y-auto">
				{#each nearby as { place, distanceM } (place.id)}
					<li>
						<a
							href="/merchant/{place.id}"
							onclick={() =>
								trackEvent("add_place_nearby_candidate_click", {
									placeId: place.id,
								})}
							class="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 hover:underline"
						>
							<span class="font-semibold text-link"
								>{place.name || $_("map.placement.nearbyUnnamed")}</span
							>
							<span class="shrink-0 text-sm text-body dark:text-offwhite"
								>{Math.round(distanceM)} m</span
							>
						</a>
					</li>
				{/each}
			</ul>
			<div class="mt-4 flex gap-3">
				<button
					bind:this={backButtonEl}
					type="button"
					onclick={backToConfirm}
					class="h-12 rounded-xl border border-input px-5 font-semibold text-body dark:text-offwhite"
				>
					{$_("map.placement.nearbyBack")}
				</button>
				<button
					type="button"
					onclick={addAnyway}
					class="h-12 flex-1 rounded-xl bg-bitcoin font-semibold text-white hover:bg-bitcoinHover"
				>
					{$_("map.placement.nearbyContinue")}
				</button>
			</div>
		{/if}
	</div>
{/if}
