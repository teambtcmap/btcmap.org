<script lang="ts">
import IconIconify from "@iconify/svelte";
import { iconLoaded, loadIcon } from "@iconify/svelte/dist/functions";

import {
	noteIconCandidates,
	readyNoteIcon,
	resolveNoteIcon,
} from "#lib/noteIcons.js";

import type { Note } from "$types/btcmap-api/Note";

// A note's Material Symbols glyph outside the map (card, picker, list).
// Walks the same cascade as the pin sprites: the outlined glyph, the base
// name, the default note glyph. Bundled names resolve without a request;
// an Android-picked icon outside the bundle loads from Iconify.
type Props = {
	icon: Note["icon"];
	class?: string;
};

let { icon, class: className = "" }: Props = $props();

const candidates = $derived(noteIconCandidates(icon));
// A bundled first candidate (every picker icon) paints immediately;
// otherwise walk the cascade, loading each name before falling through.
let resolved = $state<string | null>(null);

$effect(() => {
	const names = candidates;
	const ready = readyNoteIcon(names, iconLoaded);
	if (ready) {
		resolved = ready;
		return;
	}
	let cancelled = false;
	resolved = null;
	resolveNoteIcon(names, { loaded: iconLoaded, load: loadIcon }).then(
		(name) => {
			if (!cancelled) resolved = name;
		},
	);
	return () => {
		cancelled = true;
	};
});
</script>

{#if resolved}
	<IconIconify icon={resolved} class={className} aria-hidden="true" />
{:else}
	<span class="inline-block {className}" aria-hidden="true"></span>
{/if}
