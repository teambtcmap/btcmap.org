<script lang="ts">
import type { Snippet } from "svelte";
import { onDestroy, tick } from "svelte";
import { fade, fly } from "svelte/transition";

import { lockBodyScroll, unlockBodyScroll } from "#lib/bodyScrollLock.js";
import { trapTab } from "#lib/focusTrap.js";
import { portal } from "#lib/portal.js";
import CloseButton from "$components/CloseButton.svelte";

type Props = {
	open?: boolean;
	title: string;
	titleId?: string;
	// 440px instead of 320px on wider screens, for content with its own
	// controls (the login tabs)
	wide?: boolean;
	children?: Snippet;
};

let {
	open = $bindable(false),
	title,
	titleId = "modal-title",
	wide = false,
	children,
}: Props = $props();

let triggerEl: HTMLElement | null = null;
let modalEl = $state<HTMLDivElement>();
let hasBeenOpened = false;
let scrollLocked = false;

// .pre, like the legacy $: it replaces: the trigger has to be read off
// document.activeElement before the dialog renders and takes focus.
$effect.pre(() => {
	if (open) {
		hasBeenOpened = true;
		if (!triggerEl && typeof document !== "undefined") {
			triggerEl = document.activeElement as HTMLElement | null;
		}
		if (!scrollLocked) {
			lockBodyScroll();
			scrollLocked = true;
		}
		tick().then(() => {
			modalEl?.querySelector<HTMLElement>("button, a, [tabindex]")?.focus();
		});
	} else if (hasBeenOpened) {
		tick().then(() => {
			triggerEl?.focus();
			triggerEl = null;
		});
		if (scrollLocked) {
			unlockBodyScroll();
			scrollLocked = false;
		}
	}
});

onDestroy(() => {
	if (scrollLocked) unlockBodyScroll();
});

// Capture phase + stopPropagation: the map drawers close themselves on a
// bubbling window Escape, which would take the drawer down with the modal.
function handleKeydown(e: KeyboardEvent) {
	if (!open) return;
	if (e.key === "Escape") {
		e.stopPropagation();
		open = false;
	}
	// aria-modal: Tab must not walk out to the page behind the backdrop
	else if (modalEl) trapTab(e, modalEl);
}

export function setTrigger(el: HTMLElement) {
	triggerEl = el;
}
</script>

<svelte:window onkeydowncapture={handleKeydown} />

{#if open}
	<!-- Portalled to <body>: a caller inside a stacking context (the merchant
	     hero's Save button) would otherwise trap the overlay under its
	     siblings. -->
	<div use:portal>
	<div
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-[1000] bg-black/40 dark:bg-black/60"
		onclick={() => (open = false)}
		aria-hidden="true"
	></div>

	<!-- Below 640px a bottom sheet (#1568): the full width for the content,
	     the page still visible above it. -->
	<div
		bind:this={modalEl}
		transition:fly={{ y: 200, duration: 300 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		class="fixed inset-x-0 bottom-0 z-[2000] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-t border-gray-300 bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-white/95 dark:bg-dark sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto {wide
			? 'sm:w-[27.5rem]'
			: 'sm:w-80'} sm:max-h-[90dvh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border sm:px-6 sm:pt-6 sm:pb-6"
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 id={titleId} class="text-lg font-semibold text-primary dark:text-white">
				{title}
			</h2>
			<CloseButton on:click={() => (open = false)} />
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
			{@render children?.()}
		</div>
	</div>
	</div>
{/if}
