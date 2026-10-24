<script lang="ts">
import { _ } from "#lib/i18n/index.js";
import { NOTE_ICONS, normalizeNoteIcon } from "#lib/noteIcons.js";
import NoteGlyph from "$components/notes/NoteGlyph.svelte";

import type { Note } from "$types/btcmap-api/Note";

// The curated note icons as a radio group (#1542). A note picked on Android
// can carry any Material Symbols name; that icon leads the list while it's
// the selection, so editing such a note doesn't silently drop it.
type Props = {
	id: string;
	value: Note["icon"];
	disabled?: boolean;
};

let { id, value = $bindable(), disabled = false }: Props = $props();

const current = $derived(normalizeNoteIcon(value));
const choices = $derived(
	NOTE_ICONS.includes(current) ? NOTE_ICONS : [current, ...NOTE_ICONS],
);

// Roving focus: arrows move between chips, as a native radio group does.
const move = (event: KeyboardEvent, index: number) => {
	const step =
		event.key === "ArrowRight" || event.key === "ArrowDown"
			? 1
			: event.key === "ArrowLeft" || event.key === "ArrowUp"
				? -1
				: 0;
	if (!step) return;
	event.preventDefault();
	const next = (index + step + choices.length) % choices.length;
	value = choices[next];
	const group = (event.currentTarget as HTMLElement).parentElement;
	(group?.children[next] as HTMLElement | undefined)?.focus();
};
</script>

<div>
	<span id="{id}-label" class="mb-2 block text-sm font-semibold text-primary dark:text-white">
		{$_("notes.icon")}
	</span>
	<div
		role="radiogroup"
		aria-labelledby="{id}-label"
		class="grid max-h-32 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5 overflow-y-auto p-0.5"
	>
		{#each choices as icon, index (icon)}
			{@const selected = icon === current}
			<button
				type="button"
				role="radio"
				aria-checked={selected}
				aria-label={icon.replaceAll("_", " ")}
				title={icon.replaceAll("_", " ")}
				tabindex={selected ? 0 : -1}
				{disabled}
				onclick={() => (value = icon)}
				onkeydown={(event) => move(event, index)}
				class="flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:opacity-50 {selected
					? 'bg-link text-white'
					: 'bg-gray-100 text-primary hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'}"
			>
				<NoteGlyph {icon} class="h-5 w-5" />
			</button>
		{/each}
	</div>
</div>
