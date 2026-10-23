<script lang="ts">
import { createForm } from "@tanstack/svelte-form";
import { untrack } from "svelte";

import { _ } from "#lib/i18n/index.js";
import {
	NOTE_FIELD_ORDER,
	NOTE_TEXT_MAX_LENGTH,
	validateNote,
} from "#lib/noteValidation.js";
import { fieldError, inputProps, ruleValidation } from "#lib/ruleValidation.js";
import TextArea from "$components/form/TextArea.svelte";
import NoteIconPicker from "$components/notes/NoteIconPicker.svelte";
import NoteVisibilitySwitch from "$components/notes/NoteVisibilitySwitch.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";

import type { PostNoteArgs } from "$types/btcmap-api/PostNoteArgs";

// The note card's form (#1542): adding a note, and editing one's text and
// icon. Visibility is part of the add form only; an existing note toggles
// it straight from the card. The form always holds an icon, so the API's
// optional `icon` is required here.
export type NoteFormValues = Required<
	Pick<PostNoteArgs, "text" | "icon" | "public">
>;

type Props = {
	id: string;
	initial: NoteFormValues;
	showVisibility: boolean;
	submitLabel: string;
	// Resolves once saved; a rejection keeps the form open with its input.
	onSubmit: (values: NoteFormValues) => Promise<void>;
	onCancel: () => void;
};

let { id, initial, showVisibility, submitLabel, onSubmit, onCancel }: Props =
	$props();

let textInput = $state<HTMLTextAreaElement>();
let saving = $state(false);

const validation = ruleValidation({
	order: NOTE_FIELD_ORDER,
	validate: validateNote,
	controls: { text: () => textInput },
});

// Taken once: the card re-renders with a fresh `initial` object whenever
// the notes store updates, and new defaults would reset untouched fields.
const defaultValues = untrack(() => ({ ...initial }));

const form = createForm(() => ({
	defaultValues,
	...validation.options,
	onSubmit: async ({ value }) => {
		saving = true;
		try {
			await onSubmit({ ...value, text: value.text.trim() });
		} finally {
			saving = false;
		}
	},
}));

// Rule codes from validateNote, as fieldError reports them
const textError = (code: string | undefined): string | undefined =>
	code === "required"
		? $_("notes.textRequired")
		: code === "tooLong"
			? $_("notes.textTooLong", { values: { max: NOTE_TEXT_MAX_LENGTH } })
			: undefined;

function handleSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (saving) return;
	validation.submit(form);
}

// Focus the text as the card opens: writing is the whole point of it.
$effect(() => {
	textInput?.focus();
});
</script>

<form onsubmit={handleSubmit} novalidate class="space-y-4">
	<form.Field name="text">
		{#snippet children(field)}
			<TextArea
				id="{id}-text"
				label={$_("notes.textLabel")}
				rows={4}
				placeholder={$_("notes.textPlaceholder")}
				{...inputProps(field)}
				error={textError(fieldError(field))}
				bind:element={textInput}
			/>
		{/snippet}
	</form.Field>

	<form.Field name="icon">
		{#snippet children(field)}
			<NoteIconPicker
				id="{id}-icon"
				disabled={saving}
				bind:value={() => field.state.value, (icon) => field.handleChange(icon)}
			/>
		{/snippet}
	</form.Field>

	{#if showVisibility}
		<form.Field name="public">
			{#snippet children(field)}
				<NoteVisibilitySwitch
					checked={field.state.value}
					disabled={saving}
					onchange={(next) => field.handleChange(next)}
				/>
			{/snippet}
		</form.Field>
	{/if}

	<div class="flex items-center justify-end gap-2">
		<button
			type="button"
			onclick={onCancel}
			class="rounded-lg px-4 py-2 text-sm font-semibold text-body hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
		>
			{$_("notes.cancel")}
		</button>
		<PrimaryButton type="submit" busy={saving} style="rounded-lg px-4 py-2 text-sm">
			{saving ? $_("notes.saving") : submitLabel}
		</PrimaryButton>
	</div>
</form>
