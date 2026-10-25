<script lang="ts">
import { trackEvent } from "#lib/analytics.js";
import { errorStatus } from "#lib/apiError.js";
import { authedClient } from "#lib/authedApi.js";
import { _ } from "#lib/i18n/index.js";
import type { NoteDraft } from "#lib/noteCard.js";
import { noteCard } from "#lib/noteCard.js";
import { NOTE_PIN_COLOR } from "#lib/noteIcons.js";
import { createNote, deleteNote, myNotes, updateNote } from "#lib/notes.js";
import { errToast, successToast } from "#lib/utils.js";
import LocalTime from "$components/LocalTime.svelte";
import type { NoteFormValues } from "$components/notes/NoteForm.svelte";
import NoteForm from "$components/notes/NoteForm.svelte";
import NoteGlyph from "$components/notes/NoteGlyph.svelte";
import NoteVisibilitySwitch from "$components/notes/NoteVisibilitySwitch.svelte";

import type { Note } from "$types/btcmap-api/Note";

// The note card's content (#1542): add a note at a point, or read, edit,
// re-icon, publish/unpublish and delete one. The host (NotesLayer) places
// it on the map and owns the pin.
type Props = {
	target: NoteDraft | { mode: "view"; note: Note };
	onClose: () => void;
};

let { target, onClose }: Props = $props();

type View = "read" | "edit" | "confirmDelete";
let view = $state<View>("read");
let busy = $state(false);
// The icon picked in the edit form, previewed in the header until saved;
// cleared each time the edit form opens.
let editIcon = $state<Note["icon"] | null>(null);

const headerIcon = $derived(
	target.mode === "create"
		? target.icon
		: view === "edit"
			? (editIcon ?? target.note.icon)
			: target.note.icon,
);

const titleId = "note-card-title";

// A different note (another pin) starts back on its read view.
$effect.pre(() => {
	if (target.mode === "view") {
		void target.note.id;
		view = "read";
	}
});

// The card acts for the account it was opened under: once that session
// ends, the client sends nothing, and an answer already on its way doesn't
// reach the next account's notes.
const client = authedClient();

const logFailure = (what: string, err: unknown) =>
	console.error(`Note ${what} failed:`, errorStatus(err) ?? "unknown");

async function create(values: NoteFormValues) {
	if (target.mode !== "create") return;
	try {
		const note = await createNote(
			{
				lat: target.lat,
				lon: target.lon,
				text: values.text,
				icon: values.icon,
				public: values.public,
			},
			client,
		);
		if (client.stillCurrent()) myNotes.upsert(note);
		trackEvent("note_add_success", {
			method: target.method,
			icon: values.icon,
			public: values.public,
		});
		successToast($_("notes.saved"));
		onClose();
	} catch (err) {
		logFailure("create", err);
		errToast($_("notes.saveError"));
		throw err;
	}
}

async function saveEdit(values: NoteFormValues) {
	if (target.mode !== "view") return;
	const { note } = target;
	// Send only what changed: each field is its own PATCH key.
	const patch = {
		...(values.text !== note.text && { text: values.text }),
		...(values.icon !== note.icon && { icon: values.icon }),
	};
	if (Object.keys(patch).length === 0) {
		view = "read";
		return;
	}
	try {
		const updated = await updateNote(note.id, patch, client);
		if (client.stillCurrent()) myNotes.upsert(updated);
		trackEvent("note_edit_success", {
			text: "text" in patch,
			icon: "icon" in patch,
		});
		view = "read";
	} catch (err) {
		logFailure("edit", err);
		errToast($_("notes.saveError"));
		throw err;
	}
}

async function setPublic(next: boolean) {
	if (target.mode !== "view" || busy) return;
	busy = true;
	try {
		const updated = await updateNote(target.note.id, { public: next }, client);
		if (client.stillCurrent()) myNotes.upsert(updated);
		trackEvent("note_visibility_change", { public: next });
	} catch (err) {
		logFailure("visibility change", err);
		errToast($_("notes.visibilityError"));
	} finally {
		busy = false;
	}
}

async function confirmDelete() {
	if (target.mode !== "view" || busy) return;
	const { id } = target.note;
	busy = true;
	try {
		await deleteNote(id, client);
		if (client.stillCurrent()) myNotes.remove(id);
		trackEvent("note_delete_success");
		successToast($_("notes.deleted"));
		onClose();
	} catch (err) {
		logFailure("delete", err);
		errToast($_("notes.deleteError"));
	} finally {
		busy = false;
	}
}

const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") onClose();
};
</script>

<div
	role="dialog"
	aria-labelledby={titleId}
	tabindex="-1"
	onkeydown={handleKeydown}
	class="w-full rounded-t-2xl bg-white p-4 shadow-lg md:w-80 md:rounded-lg dark:bg-dark"
>
	<header class="mb-3 flex items-start gap-3">
		<span
			class="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white"
			style="background-color: {NOTE_PIN_COLOR}"
		>
			<NoteGlyph icon={headerIcon} class="h-5 w-5" />
		</span>
		<div class="min-w-0 flex-1">
			<h2 id={titleId} class="font-semibold text-primary dark:text-white">
				{target.mode === "create" ? $_("notes.newNote") : $_("notes.note")}
			</h2>
			{#if target.mode === "view"}
				<p class="text-xs text-body dark:text-white/60">
					<LocalTime timestamp={target.note.created_at} />
					· {target.note.public ? $_("notes.publicBadge") : $_("notes.privateBadge")}
				</p>
			{/if}
		</div>
		<button
			type="button"
			onclick={onClose}
			aria-label={$_("notes.close")}
			class="-m-1 rounded-full p-1 text-body hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
		>
			<svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
				<path
					d="M6 6l12 12M18 6L6 18"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</header>

	{#if target.mode === "create"}
		<p class="mb-3 text-sm text-body dark:text-white/60">{$_("notes.dragHint")}</p>
		<NoteForm
			id="note-create"
			initial={{ text: "", icon: target.icon, public: false }}
			showVisibility
			submitLabel={$_("notes.save")}
			onSubmit={create}
			onCancel={onClose}
			onIconChange={noteCard.setDraftIcon}
		/>
	{:else if view === "edit"}
		<NoteForm
			id="note-edit"
			initial={{
				text: target.note.text,
				icon: target.note.icon,
				public: target.note.public,
			}}
			showVisibility={false}
			submitLabel={$_("notes.save")}
			onSubmit={saveEdit}
			onCancel={() => (view = "read")}
			onIconChange={(icon) => (editIcon = icon)}
		/>
	{:else}
		<p
			class="mb-4 max-h-60 overflow-y-auto break-words whitespace-pre-wrap text-body select-text dark:text-white"
		>
			{target.note.text}
		</p>

		<div class="mb-4">
			<NoteVisibilitySwitch
				checked={target.note.public}
				disabled={busy}
				onchange={setPublic}
			/>
		</div>

		{#if view === "confirmDelete"}
			<div
				role="alert"
				class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-950/40"
			>
				<span class="text-sm font-semibold text-primary dark:text-white">
					{$_("notes.deleteConfirm")}
				</span>
				<span class="flex gap-2">
					<button
						type="button"
						onclick={() => (view = "read")}
						class="rounded-lg px-3 py-1.5 text-sm font-semibold text-body hover:bg-white dark:text-white dark:hover:bg-white/10"
					>
						{$_("notes.cancel")}
					</button>
					<button
						type="button"
						onclick={confirmDelete}
						aria-disabled={busy}
						class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 aria-disabled:opacity-50"
					>
						{$_("notes.delete")}
					</button>
				</span>
			</div>
		{:else}
			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={() => {
						trackEvent("note_delete_click");
						view = "confirmDelete";
					}}
					class="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-white/5"
				>
					{$_("notes.delete")}
				</button>
				<button
					type="button"
					onclick={() => {
						trackEvent("note_edit_click");
						editIcon = null;
						view = "edit";
					}}
					class="rounded-lg bg-link px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
				>
					{$_("notes.edit")}
				</button>
			</div>
		{/if}
	{/if}
</div>
