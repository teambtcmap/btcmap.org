<script lang="ts">
import IconIconify from "@iconify/svelte";
import { iconLoaded, loadIcon } from "@iconify/svelte/dist/functions";

import { noteIconCandidates } from "#lib/noteIcons.js";

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
// The first bundled candidate paints immediately; otherwise start on the
// outlined name and fall through on a failed load.
let resolved = $state<string | null>(null);

$effect(() => {
	const names = candidates;
	const ready = names.find((name) => iconLoaded(name));
	if (ready) {
		resolved = ready;
		return;
	}
	let cancelled = false;
	resolved = null;
	(async () => {
		for (const name of names) {
			try {
				await loadIcon(name);
				if (!cancelled) resolved = name;
				return;
			} catch {
				// Not in the set: try the next candidate
			}
		}
	})();
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
