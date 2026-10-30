<script lang="ts">
import { tick, untrack } from "svelte";
import type { DndEvent } from "svelte-dnd-action";
import { dndzone } from "svelte-dnd-action";

import type { PlacePhotoSource } from "#lib/analytics.js";
import { trackEvent, trackFailure } from "#lib/analytics.js";
import { errorStatus } from "#lib/apiError.js";
import { _ } from "#lib/i18n/index.js";
import {
	moveItem,
	photoAuthorName,
	placePhotoUrl,
	reorderErrorKey,
	reorderPlacePhotos,
} from "#lib/placePhotos.js";
import { errToast, successToast } from "#lib/utils.js";
import Icon from "$components/Icon.svelte";
import Modal from "$components/Modal.svelte";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// Admin dialog that sets a place's photo order (#1594): drag the rows, or
// move them with the arrow buttons (keyboard and screen readers). Nothing
// changes until Save, which sends the whole list in one call.
type Props = {
	open?: boolean;
	placeId: number;
	photos: PlaceImage[];
	source: PlacePhotoSource;
	// With the place it saved for: the drawer may have moved on meanwhile
	onSaved: (photos: PlaceImage[], placeId: number) => void;
	// 409: a photo was added or deleted meanwhile; the strip refetches
	onConflict: () => void;
};

let {
	open = $bindable(false),
	placeId,
	photos,
	source,
	onSaved,
	onConflict,
}: Props = $props();

const THUMB = 56;

let items = $state<PlaceImage[]>([]);
let saving = $state(false);
let saved = false;
let wasOpen = false;
const rowButtons: Record<string, HTMLButtonElement | undefined> = $state({});

// Start from the strip's order each time the dialog opens; closing without
// saving is a cancel
$effect(() => {
	if (open && !wasOpen) {
		items = untrack(() => [...photos]);
		saved = false;
	} else if (!open && wasOpen && !saved) {
		trackEvent("place_photo_reorder_cancel", { source });
	}
	wasOpen = open;
});

const unchanged = $derived(
	items.length === photos.length &&
		items.every((photo, i) => photo.id === photos[i].id),
);

const handleDnd = (event: CustomEvent<DndEvent<PlaceImage>>) => {
	items = event.detail.items;
};

// Keep focus on the same button of the moved row, so repeated presses
// keep moving it
const move = async (from: number, to: number, direction: "up" | "down") => {
	const id = items[from].id;
	items = moveItem(items, from, to);
	await tick();
	const target =
		rowButtons[`${id}-${direction}`] ??
		rowButtons[`${id}-${direction === "up" ? "down" : "up"}`];
	target?.focus();
};

const save = async () => {
	if (saving || unchanged) return;
	saving = true;
	const id = placeId;
	try {
		const result = await reorderPlacePhotos(
			id,
			items.map((photo) => photo.id),
		);
		saved = true;
		trackEvent("place_photo_reorder_success", { source, count: result.length });
		successToast($_("placePhotos.reordered"));
		onSaved(result, id);
		open = false;
	} catch (error) {
		trackFailure("place_photo_reorder_failure", { source }, error);
		console.error("place photos: reorder failed", errorStatus(error));
		errToast($_(reorderErrorKey(error)));
		if (reorderErrorKey(error) === "placePhotos.reorderConflict") {
			open = false;
			onConflict();
		}
	} finally {
		saving = false;
	}
};
</script>

<Modal bind:open title={$_('placePhotos.reorderTitle')} titleId="photo-reorder-title" wide>
	<p class="mb-3 text-sm text-body dark:text-white/70">{$_('placePhotos.reorderHint')}</p>

	<ol
		role="list"
		class="max-h-[60vh] space-y-2 overflow-y-auto"
		use:dndzone={{ items, flipDurationMs: 150, dropTargetStyle: {}, type: 'place-photos' }}
		onconsider={handleDnd}
		onfinalize={handleDnd}
	>
		{#each items as photo, i (photo.id)}
			<li class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-dark">
				<span class="flex-none cursor-grab text-mapLabel dark:text-white/50" aria-hidden="true">
					<Icon w="20" h="20" icon="drag_indicator" type="material" />
				</span>
				<img
					src={placePhotoUrl(placeId, photo.id, { h: THUMB * 2 })}
					alt=""
					width={THUMB}
					height={THUMB}
					referrerpolicy="no-referrer"
					draggable="false"
					class="size-14 flex-none rounded-lg bg-link/50 object-cover dark:bg-white/10"
				/>
				<span class="min-w-0 flex-1 text-sm">
					<span class="block font-semibold text-primary dark:text-white">
						{$_('placePhotos.photoAlt', { values: { n: i + 1, total: items.length } })}
					</span>
					<span class="block truncate text-body dark:text-white/70">
						{photoAuthorName(photo) ?? $_('placePhotos.communityPhoto')}
					</span>
				</span>
				<span class="flex flex-none gap-1">
					{#if i > 0}
						<button
							bind:this={rowButtons[`${photo.id}-up`]}
							type="button"
							onclick={() => move(i, i - 1, 'up')}
							class="flex h-9 w-9 items-center justify-center rounded-lg text-link hover:bg-link/10 {i === items.length - 1 ? 'mr-10' : ''}"
							aria-label="{$_('placePhotos.moveUp')}: {$_('placePhotos.photoAlt', { values: { n: i + 1, total: items.length } })}"
						>
							<Icon w="20" h="20" icon="keyboard_arrow_up" type="material" />
						</button>
					{/if}
					{#if i < items.length - 1}
						<button
							bind:this={rowButtons[`${photo.id}-down`]}
							type="button"
							onclick={() => move(i, i + 1, 'down')}
							class="flex h-9 w-9 items-center justify-center rounded-lg text-link hover:bg-link/10 {i === 0 ? 'ml-10' : ''}"
							aria-label="{$_('placePhotos.moveDown')}: {$_('placePhotos.photoAlt', { values: { n: i + 1, total: items.length } })}"
						>
							<Icon w="20" h="20" icon="keyboard_arrow_down" type="material" />
						</button>
					{/if}
				</span>
			</li>
		{/each}
	</ol>

	<div class="mt-4 flex justify-end gap-2">
		<button
			type="button"
			onclick={() => (open = false)}
			class="rounded-lg px-4 py-2 text-sm font-semibold text-link hover:bg-link/10"
		>
			{$_('forms.cancel')}
		</button>
		<button
			type="button"
			onclick={save}
			disabled={saving || unchanged}
			class="rounded-lg bg-link px-4 py-2 text-sm font-semibold text-white hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
		>
			{$_('placePhotos.saveOrder')}
		</button>
	</div>
</Modal>
