<script lang="ts">
import type {
	MapLayerMouseEvent,
	Map as MapLibreMap,
	MapMouseEvent,
	Marker,
} from "maplibre-gl";
import { onMount, untrack } from "svelte";
import { get } from "svelte/store";

import { trackEvent } from "#lib/analytics.js";
import { BREAKPOINTS } from "#lib/constants.js";
import { isEmbedded } from "#lib/embed.js";
import { _ } from "#lib/i18n/index.js";
import {
	notePinDataUrl,
	PIN_HEIGHT,
	PIN_WIDTH,
} from "#lib/map/maplibreSprites.js";
import {
	installNoteLayer,
	NOTE_LAYER_ID,
	syncNotes,
} from "#lib/map/notePinSource.js";
import { merchantDrawer } from "#lib/merchantDrawerStore.js";
import {
	fromLngLat,
	NOTE_PARAM,
	noteCard,
	parseNoteParam,
} from "#lib/noteCard.js";
import { myNotes } from "#lib/notes.js";
import { session } from "#lib/session.js";
import { errToast } from "#lib/utils.js";
import HydratingAuthPrompt from "$components/auth/HydratingAuthPrompt.svelte";
import NoteCard from "$components/notes/NoteCard.svelte";

// The signed-in user's notes on /map (#1542): the pin layer, the note card
// (add / read / edit) anchored at its pin, the draggable pin of a note
// being added, the in-place sign-in for adding one, and the ?note=<id>
// link /user/notes rows open. Mounted only while the style is ready (a
// basemap swap remounts it, reinstalling the layer) and outside ?issues
// mode; embeds (an iframe) never show the viewer's private notes.
type Props = {
	map: MapLibreMap;
	// Add-place placement is running: notes hide so they can't be taken
	// for existing places or cover the crosshair.
	suspended: boolean;
};

let { map, suspended }: Props = $props();

// Desktop card: its bottom edge sits this far above the pin's tip (clears
// the pin itself), and it keeps this margin from the map's top edge.
const CARD_PIN_GAP = 52;
const EDGE_MARGIN = 16;

const embedded = isEmbedded();
const desktop = window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`).matches;

const token = $derived($session?.token || null);
const viewedNote = $derived(
	$noteCard?.mode === "view"
		? ($myNotes.notes.find((n) => n.id === $noteCard.id) ?? null)
		: null,
);
const point = $derived(
	$noteCard?.mode === "create"
		? { lat: $noteCard.lat, lon: $noteCard.lon }
		: viewedNote
			? { lat: viewedNote.lat, lon: viewedNote.lon }
			: null,
);
const showCard = $derived(
	!embedded &&
		!suspended &&
		!!token &&
		($noteCard?.mode === "create" || viewedNote !== null),
);

// Adding while signed out asks to sign in first; the card opens after.
let authPromptOpen = $state(false);
$effect(() => {
	if ($noteCard?.mode === "create" && !token && !suspended) {
		authPromptOpen = true;
	}
});
// Dismissed without signing in: drop the pending card.
let promptWasOpen = false;
$effect(() => {
	if (promptWasOpen && !authPromptOpen && !get(session)) noteCard.close();
	promptWasOpen = authPromptOpen;
});

// A viewed note that went away (deleted, logout) closes its card.
$effect(() => {
	if (
		$noteCard?.mode === "view" &&
		$myNotes.status === "ready" &&
		!viewedNote
	) {
		noteCard.close();
	}
});

// The map menu asked for an add card: it opens at the map centre, unless
// placement holds the map.
$effect(() => {
	const card = $noteCard;
	if (card?.mode !== "request") return;
	untrack(() => {
		if (suspended) noteCard.close();
		else noteCard.openCreate(fromLngLat(map.getCenter()), card.method);
	});
});

// Placement takes the map: no note card on top of it.
$effect(() => {
	if (suspended) noteCard.close();
});

// One panel at a time: the note card and the merchant drawer share the map.
let cardWasOpen = false;
let drawerWasOpen = false;
$effect(() => {
	const cardOpen = $noteCard !== null;
	const drawerOpen = $merchantDrawer.isOpen;
	if (cardOpen && !cardWasOpen && drawerOpen) merchantDrawer.close();
	else if (drawerOpen && !drawerWasOpen && cardOpen) noteCard.close();
	cardWasOpen = cardOpen;
	drawerWasOpen = drawerOpen;
});

// Layer and data.
onMount(() => {
	if (embedded) return;
	installNoteLayer(map);

	const setPointer = () => {
		map.getCanvas().style.cursor = "pointer";
	};
	const resetCursor = () => {
		map.getCanvas().style.cursor = "";
	};
	const onNoteClick = (e: MapLayerMouseEvent) => {
		const id = e.features?.[0]?.properties?.id;
		if (typeof id !== "number") return;
		noteCard.openView(id);
		trackEvent("note_open", { source: "map" });
	};
	// An empty-map click closes a viewed note; an unsaved add card stays,
	// so a stray click can't throw away what was typed.
	const onMapClick = (e: MapMouseEvent) => {
		if (get(noteCard)?.mode !== "view") return;
		const hit = map.queryRenderedFeatures(e.point, { layers: [NOTE_LAYER_ID] });
		if (hit.length === 0) noteCard.close();
	};

	map.on("click", NOTE_LAYER_ID, onNoteClick);
	map.on("mouseenter", NOTE_LAYER_ID, setPointer);
	map.on("mouseleave", NOTE_LAYER_ID, resetCursor);
	map.on("click", onMapClick);
	return () => {
		map.off("click", NOTE_LAYER_ID, onNoteClick);
		map.off("mouseenter", NOTE_LAYER_ID, setPointer);
		map.off("mouseleave", NOTE_LAYER_ID, resetCursor);
		map.off("click", onMapClick);
	};
});

$effect(() => {
	if (embedded) return;
	syncNotes(map, $myNotes.notes, !suspended);
});

// ?note=<id>: open that note once the notes are in, then drop the param so
// a reload or a shared URL doesn't reopen it.
onMount(() => {
	if (embedded) return;
	const url = new URL(window.location.href);
	if (!url.searchParams.has(NOTE_PARAM)) return;
	const id = parseNoteParam(url.searchParams.get(NOTE_PARAM));
	url.searchParams.delete(NOTE_PARAM);
	history.replaceState(history.state, "", url);
	if (id === null) return;

	let done = false;
	let stop: (() => void) | undefined;
	stop = myNotes.subscribe((state) => {
		if (done || state.status === "loading") return;
		done = true;
		const note = state.notes.find((n) => n.id === id);
		if (note) {
			noteCard.openView(id);
			// A ?note link: the /user/notes rows, or a shared /map URL
			trackEvent("note_open", { source: "link" });
			map.jumpTo({
				center: [note.lon, note.lat],
				zoom: Math.max(map.getZoom(), 17),
			});
		} else {
			errToast(
				state.status === "signed-out"
					? $_("notes.signInToView")
					: $_("notes.notFound"),
			);
		}
		// subscribe() calls back before it returns, so `stop` may not be set
		// yet on this first call.
		queueMicrotask(() => stop?.());
	});
	return () => stop?.();
});

// The add card's pin: draggable until saved (a note can't move after).
let draftMarker: Marker | undefined;
// The same pin the map draws for a saved note, showing the picked icon.
let draftPin = $state<HTMLImageElement>();
const pinElement = () => {
	const el = document.createElement("img");
	el.alt = "";
	el.width = PIN_WIDTH;
	el.height = PIN_HEIGHT;
	el.draggable = false;
	el.style.cursor = "grab";
	draftPin = el;
	return el;
};

$effect(() => {
	const img = draftPin;
	const icon = $noteCard?.mode === "create" ? $noteCard.icon : null;
	if (!img || !icon) return;
	let stale = false;
	notePinDataUrl(icon)
		.then((src) => {
			if (!stale) img.src = src;
		})
		.catch(() => {});
	return () => {
		stale = true;
	};
});

$effect(() => {
	const draft = $noteCard?.mode === "create" && showCard ? $noteCard : null;
	if (!draft) {
		draftMarker?.remove();
		draftMarker = undefined;
		draftPin = undefined;
		return;
	}
	if (draftMarker) {
		draftMarker.setLngLat([draft.lon, draft.lat]);
		return;
	}
	let cancelled = false;
	import("maplibre-gl").then(({ Marker }) => {
		if (cancelled || draftMarker) return;
		draftMarker = new Marker({
			element: pinElement(),
			anchor: "bottom",
			draggable: true,
		})
			.setLngLat([draft.lon, draft.lat])
			.addTo(map);
		draftMarker.on("dragend", () => {
			const at = draftMarker?.getLngLat();
			if (at) noteCard.moveDraft(fromLngLat(at));
		});
	});
	return () => {
		cancelled = true;
	};
});

$effect(() => () => {
	draftMarker?.remove();
});

// Keep the card next to its pin while the map moves (desktop; on mobile it
// sits at the bottom edge).
let screen = $state<{ x: number; y: number } | null>(null);
$effect(() => {
	const at = point;
	if (!at || !showCard || !desktop) {
		screen = null;
		return;
	}
	const place = () => {
		const p = map.project([at.lon, at.lat]);
		screen = { x: p.x, y: p.y };
	};
	place();
	map.on("move", place);
	return () => {
		map.off("move", place);
	};
});

// Bring the pin into view with room for the card above it (desktop) or
// above the bottom card (mobile). Once per opened card, not on every drag.
// On desktop that room is the card's measured height, so it waits for it.
let cardHeight = $state(0);
let framedKey: string | null = null;
$effect(() => {
	const card = $noteCard;
	if (!card || !showCard || !point) {
		framedKey = null;
		return;
	}
	if (!cardHeight) return;
	const key = card.mode === "view" ? `view-${card.id}` : "create";
	if (key === framedKey) return;
	framedKey = key;
	untrack(() => {
		const mapHeight = map.getContainer().clientHeight;
		// Where the pin should sit: the card fits above it, the pin stays on screen
		const pinY = Math.min(
			cardHeight + CARD_PIN_GAP + EDGE_MARGIN,
			mapHeight - EDGE_MARGIN,
		);
		map.easeTo({
			center: [point.lon, point.lat],
			// Mobile: the middle of the map left visible above the bottom card
			offset: desktop
				? [0, Math.max(pinY - mapHeight / 2, 0)]
				: [0, -cardHeight / 2 + PIN_HEIGHT / 2],
			duration: 300,
		});
	});
});

// A card that grows while open (read → edit) would run off the top: nudge
// the map down by what is missing. Reacts to the height only, so it never
// fights the user panning the map, and skips a card's first measurement,
// which the framing above already accounts for.
let measured: { key: string; height: number } | null = null;
$effect(() => {
	const height = cardHeight;
	if (!desktop || !height) return;
	untrack(() => {
		const key = framedKey;
		const grew =
			key !== null && measured?.key === key && height > measured.height;
		measured = key === null ? null : { key, height };
		if (!grew || !screen) return;
		const missing = height + CARD_PIN_GAP + EDGE_MARGIN - screen.y;
		if (missing > 0) map.panBy([0, -missing], { duration: 300 });
	});
});
</script>

{#if showCard && token && $noteCard}
	{@const target =
		$noteCard.mode === "create"
			? $noteCard
			: viewedNote
				? { mode: "view" as const, note: viewedNote }
				: null}
	{#if target}
		<div
			bind:clientHeight={cardHeight}
			class="fixed inset-x-0 bottom-0 z-[1002] pb-[env(safe-area-inset-bottom)] md:absolute md:inset-x-auto md:bottom-auto md:pb-0 {desktop &&
			!screen
				? 'invisible'
				: ''}"
			style={screen
				? `left: ${screen.x}px; top: ${screen.y}px; transform: translate(-50%, calc(-100% - ${CARD_PIN_GAP}px));`
				: undefined}
		>
			<NoteCard {token} {target} onClose={() => noteCard.close()} />
		</div>
	{/if}
{/if}

<HydratingAuthPrompt
	bind:open={authPromptOpen}
	titleId="note-auth-prompt-title"
	title={$_("notes.promptTitle")}
	description={$_("notes.promptDescription")}
	onCreateAccountClick={() => trackEvent("note_prompt_create_account_click")}
	onLoginClick={() => trackEvent("note_prompt_login_click")}
/>
