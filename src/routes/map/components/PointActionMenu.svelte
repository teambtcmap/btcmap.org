<script lang="ts">
import type { Map as MapLibreMap } from "maplibre-gl";
import { tick } from "svelte";

import type { NoteAddMethod } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import { _ } from "#lib/i18n/index.js";
import { fromLngLat, noteCard } from "#lib/noteCard.js";

// The menu a long-press (touch) or right-click (desktop) opens at that point
// on /map (#1542): add a place there, or a note. AddPlaceMode detects the
// gesture and owns placement; this menu owns the choice.
export type PointGesture = Exclude<NoteAddMethod, "menu">;

export type MapPoint = {
	lngLat: { lng: number; lat: number };
	// Where it was pressed, in px from the map's top-left corner
	x: number;
	y: number;
	method: PointGesture;
};

type Props = {
	map: MapLibreMap;
	point: MapPoint | null;
	onAddPlace: (point: MapPoint) => void;
};

let { map, point = $bindable(), onAddPlace }: Props = $props();

// Ignore the click some mobile browsers synthesize when the long-press
// finger lifts.
const SETTLE_MS = 500;

let firstItem: HTMLButtonElement | undefined = $state();
let openedAt = 0;

$effect(() => {
	if (!point) return;
	openedAt = Date.now();
	tick().then(() => firstItem?.focus());
});

// Any map interaction dismisses the menu.
$effect(() => {
	if (!point) return;
	const dismiss = () => {
		if (Date.now() - openedAt < SETTLE_MS) return;
		point = null;
	};
	map.on("movestart", dismiss);
	map.on("click", dismiss);
	return () => {
		map.off("movestart", dismiss);
		map.off("click", dismiss);
	};
});

const addPlace = () => {
	if (!point) return;
	const chosen = point;
	point = null;
	onAddPlace(chosen);
};

const addNote = () => {
	if (!point) return;
	const { lngLat, method } = point;
	point = null;
	trackEvent("note_add_click", { method });
	noteCard.openCreate(fromLngLat(lngLat), method);
};

const itemClass =
	"block w-full px-4 py-2.5 text-left text-body hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-white dark:hover:bg-white/5 dark:focus-visible:bg-white/5";
</script>

<svelte:window
	onkeydown={(event) => {
		if (point && event.key === "Escape") point = null;
	}}
/>

{#if point}
	<div
		role="menu"
		aria-label={$_("notes.pointMenuLabel")}
		class="absolute z-[1003] min-w-44 overflow-hidden rounded-lg bg-white py-1 shadow-lg dark:bg-dark"
		style="left: min({point.x}px, calc(100% - 12rem)); top: min({point.y}px, calc(100% - 7rem))"
	>
		<button
			bind:this={firstItem}
			type="button"
			role="menuitem"
			onclick={addPlace}
			class={itemClass}
		>
			{$_("notes.addPlaceHere")}
		</button>
		<button type="button" role="menuitem" onclick={addNote} class={itemClass}>
			{$_("notes.addNoteHere")}
		</button>
	</div>
{/if}
