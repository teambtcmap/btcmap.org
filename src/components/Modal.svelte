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
	tick().then(() => {
		modalEl?.querySelector<HTMLElement>("button, a, [tabindex]")?.focus();
	});
} else if (hasBeenOpened) {
	tick().then(() => {
		triggerEl?.focus();
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
			class="z-[2000] flex flex-col overflow-auto border border-gray-300 bg-white p-6 shadow-2xl fixed inset-0 w-full h-full dark:border-white/95 dark:bg-dark md:inset-auto md:top-1/2 md:left-1/2 md:w-80 md:max-h-[90vh] md:h-auto md:rounded-xl md:translate-x-[-50%] md:translate-y-[-50%]"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 id={titleId} class="text-lg font-semibold text-primary dark:text-white">
					{title}
				</h2>
				<CloseButton on:click={() => (open = false)} />
			</div>

			<slot />
		</div>
	</OutClick>
{/if}
