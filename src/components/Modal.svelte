<script lang="ts">
import { tick } from "svelte";
import { fly } from "svelte/transition";
import OutClick from "svelte-outclick";

import CloseButton from "$components/CloseButton.svelte";

export let open = false;
export let title: string;
export let titleId: string = "modal-title";

let triggerEl: HTMLElement | null = null;
let modalEl: HTMLDivElement;
let hasBeenOpened = false;

$: if (open) {
	hasBeenOpened = true;
	if (!triggerEl && typeof document !== "undefined") {
		triggerEl = document.activeElement as HTMLElement | null;
	}
	tick().then(() => {
		modalEl?.querySelector<HTMLElement>("button, a, [tabindex]")?.focus();
	});
} else if (hasBeenOpened) {
	tick().then(() => {
		triggerEl?.focus();
		triggerEl = null;
	});
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
	<OutClick on:outclick={() => (open = false)}>
		<div
			bind:this={modalEl}
			transition:fly={{ y: 200, duration: 300 }}
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			class="z-[2000] flex flex-col overflow-hidden border border-gray-300 bg-white shadow-2xl fixed inset-x-4 bottom-4 max-h-[85dvh] rounded-2xl dark:border-white/95 dark:bg-dark sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-80 sm:max-h-[90vh] sm:h-auto sm:rounded-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:px-6 sm:py-6 px-5 py-5"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 id={titleId} class="text-lg font-semibold text-primary dark:text-white">
					{title}
				</h2>
				<CloseButton on:click={() => (open = false)} />
			</div>

			<div class="flex-1 overflow-y-auto -mx-5 px-5">
				<slot />
			</div>
		</div>
	</OutClick>
{/if}
