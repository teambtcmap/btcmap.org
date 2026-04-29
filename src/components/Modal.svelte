<script lang="ts">
import { tick } from "svelte";
import { fade, fly } from "svelte/transition";

import CloseButton from "$components/CloseButton.svelte";

export let open = false;
export let title: string;
export let titleId: string = "modal-title";

let triggerEl: HTMLElement | null = null;
let modalEl: HTMLDivElement;
let hasBeenOpened = false;
let originalOverflow = "";

$: if (open) {
	hasBeenOpened = true;
	if (!triggerEl && typeof document !== "undefined") {
		triggerEl = document.activeElement as HTMLElement | null;
	}
	if (typeof document !== "undefined") {
		originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
	}
	tick().then(() => {
		modalEl?.querySelector<HTMLElement>("button, a, [tabindex]")?.focus();
	});
} else if (hasBeenOpened) {
	tick().then(() => {
		triggerEl?.focus();
		triggerEl = null;
	});
	if (typeof document !== "undefined") {
		document.body.style.overflow = originalOverflow || "";
	}
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape" && open) open = false;
}

export function setTrigger(el: HTMLElement) {
	triggerEl = el;
}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-no-static-element-interactions - Backdrop click closes modal, keyboard handled by dialog -->
	<!-- svelte-ignore a11y-click-events-have-key-events - Keyboard close handled by global Escape listener and dialog focus -->
	<div
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-[1000] bg-black/40 dark:bg-black/60"
		on:click={() => (open = false)}
		aria-hidden="true"
	/>

	<div
		bind:this={modalEl}
		transition:fly={{ y: 200, duration: 300 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		class="fixed inset-x-4 bottom-4 z-[2000] flex max-h-[85dvh] flex-col overflow-hidden rounded-2xl border border-gray-300 bg-white px-5 py-5 shadow-2xl dark:border-white/95 dark:bg-dark sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:w-80 sm:max-h-[90vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:px-6 sm:py-6"
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 id={titleId} class="text-lg font-semibold text-primary dark:text-white">
				{title}
			</h2>
			<CloseButton on:click={() => (open = false)} />
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
			<slot />
		</div>
	</div>
{/if}
