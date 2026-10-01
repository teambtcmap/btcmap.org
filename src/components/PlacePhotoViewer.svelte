<script lang="ts">
import { onDestroy, onMount, untrack } from "svelte";

import Icon from "$components/Icon.svelte";
import { lockBodyScroll, unlockBodyScroll } from "$lib/bodyScrollLock";
import { _ } from "$lib/i18n";
import type { PlacePhoto } from "$lib/placePhotos";
import { placePhotoUrl } from "$lib/placePhotos";

type Props = {
	placeId: number;
	photos: PlacePhoto[];
	startIndex: number;
	onClose: () => void;
};

let { placeId, photos, startIndex, onClose }: Props = $props();

let index = $state(untrack(() => startIndex));

const photo = $derived(photos[index]);
const total = $derived(photos.length);

let dialogEl = $state<HTMLDivElement>();
let triggerEl: HTMLElement | null = null;

const step = (delta: number) => {
	index = (index + delta + total) % total;
};

// Capture phase + stopPropagation: the map drawers close themselves on a
// bubbling window Escape, which would take the drawer down with the viewer.
const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") onClose();
	else if (event.key === "ArrowRight" && total > 1) step(1);
	else if (event.key === "ArrowLeft" && total > 1) step(-1);
	else return;
	event.preventDefault();
	event.stopPropagation();
};

// Render at the end of <body>: the map drawer is position-fixed with its
// own stacking context, which would trap a fixed overlay inside it.
const portal = (node: HTMLElement) => {
	document.body.appendChild(node);
	return { destroy: () => node.remove() };
};

onMount(() => {
	triggerEl = document.activeElement as HTMLElement | null;
	lockBodyScroll();
	dialogEl?.focus();
});

onDestroy(() => {
	unlockBodyScroll();
	triggerEl?.focus();
});
</script>

<svelte:window onkeydowncapture={handleKeydown} />

<div
	use:portal
	bind:this={dialogEl}
	role="dialog"
	aria-modal="true"
	aria-label={$_('placePhotos.title')}
	tabindex="-1"
	class="fixed inset-0 z-[3000] flex flex-col bg-black/95 text-white outline-none"
>
	<div class="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
		<span class="text-sm tabular-nums text-white/80">{index + 1} / {total}</span>
		<button
			type="button"
			onclick={onClose}
			class="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
			aria-label={$_('placePhotos.close')}
		>
			<Icon w="24" h="24" icon="close" type="material" />
		</button>
	</div>

	<div class="relative flex min-h-0 flex-1 items-center justify-center px-2">
		{#key photo.id}
			<img
				src={placePhotoUrl(placeId, photo.id, { w: 1600, h: 1600 })}
				alt={$_('placePhotos.photoAlt', { values: { n: index + 1, total } })}
				width={photo.width}
				height={photo.height}
				class="max-h-full max-w-full object-contain"
				referrerpolicy="no-referrer"
			/>
		{/key}

		{#if total > 1}
			<button
				type="button"
				onclick={() => step(-1)}
				class="absolute top-1/2 left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 hover:bg-black/70"
				aria-label={$_('placePhotos.previous')}
			>
				<Icon w="28" h="28" icon="chevron_left" type="material" />
			</button>
			<button
				type="button"
				onclick={() => step(1)}
				class="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 hover:bg-black/70"
				aria-label={$_('placePhotos.next')}
			>
				<Icon w="28" h="28" icon="chevron_right" type="material" />
			</button>
		{/if}
	</div>

	<p class="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/70">
		{$_('placePhotos.addedOn', {
			values: { date: new Date(photo.created_at).toLocaleDateString() },
		})}
	</p>
</div>
