<script lang="ts">
import { onMount } from "svelte";
import Time from "svelte-time";

import { trackEvent } from "#lib/analytics.js";
import { CLUSTERING_DISABLED_ZOOM } from "#lib/constants.js";
import { createTimeLocale, LOCALIZED_DATE_FORMAT } from "#lib/dayjsLocale.js";
import { _, locale } from "#lib/i18n/index.js";
import { NOTE_PARAM } from "#lib/noteCard.js";
import { NOTE_PIN_COLOR } from "#lib/noteIcons.js";
import { myNotes } from "#lib/notes.js";
import { session } from "#lib/session.js";
import NoteGlyph from "$components/notes/NoteGlyph.svelte";
import Skeleton from "$components/Skeleton.svelte";

import { goto } from "$app/navigation";
import type { Note } from "$types/btcmap-api/Note";

// "My notes" (#1542): the signed-in user's notes, newest first. A row opens
// the note on /map (?note=<id>, centred on it via the map's hash).

const SKELETON_ROWS = 3;

const timeLocale = createTimeLocale(locale);

const mapUrl = (note: Note) =>
	`/map?${NOTE_PARAM}=${note.id}#${CLUSTERING_DISABLED_ZOOM}/${note.lat.toFixed(5)}/${note.lon.toFixed(5)}`;

onMount(() => {
	if (!session.init()) goto("/login");
});
</script>

<svelte:head>
	<title>{$_("notes.myNotes")} | BTC Map</title>
</svelte:head>

<div class="mx-auto my-10 max-w-2xl space-y-8 md:my-20">
	<div class="space-y-2 text-center">
		<h1 class="text-4xl font-semibold text-primary dark:text-white">
			{$_("notes.myNotes")}
		</h1>
		<p class="text-body dark:text-white/70">{$_("notes.myNotesIntro")}</p>
	</div>

	{#if $myNotes.status === "loading" || $myNotes.status === "signed-out"}
		<div role="status" aria-label={$_("aria.loading")}>
			<ul aria-hidden="true" class="space-y-3">
				{#each { length: SKELETON_ROWS } as _row, i (i)}
					<li class="flex gap-3 rounded-2xl border border-gray-300 p-4 dark:border-white/20 dark:bg-white/5">
						<Skeleton class="h-9 w-9 rounded-full" />
						<div class="flex-1 space-y-2">
							<Skeleton class="h-4 w-3/4 rounded" />
							<Skeleton class="h-3 w-1/3 rounded" />
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{:else if $myNotes.status === "error"}
		<p class="text-center text-body dark:text-white/70">{$_("notes.loadError")}</p>
	{:else if !$myNotes.notes.length}
		<p class="text-center text-lg text-body dark:text-white/70">{$_("notes.empty")}</p>
	{:else}
		<ul role="list" class="space-y-3">
			{#each $myNotes.notes as note (note.id)}
				<li>
					<a
						href={mapUrl(note)}
						onclick={() => trackEvent("my_notes_row_click")}
						class="flex gap-3 rounded-2xl border border-gray-300 p-4 transition-colors hover:border-link dark:border-white/20 dark:bg-white/5 dark:hover:border-white/50"
					>
						<span
							class="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white"
							style="background-color: {NOTE_PIN_COLOR}"
						>
							<NoteGlyph icon={note.icon} class="h-5 w-5" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 break-words whitespace-pre-wrap text-primary dark:text-white">
								{note.text}
							</span>
							<span class="mt-1 block text-xs text-body dark:text-white/60">
								<Time timestamp={note.created_at} format={LOCALIZED_DATE_FORMAT} locale={$timeLocale} />
								· {note.public ? $_("notes.publicBadge") : $_("notes.privateBadge")}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
