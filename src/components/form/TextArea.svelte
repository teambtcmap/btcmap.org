<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLTextareaAttributes } from "svelte/elements";

import FieldError from "$components/form/FieldError.svelte";
import { fieldBorderClasses } from "$lib/fieldStyles";
import { _ } from "$lib/i18n";

// TextField's multi-line sibling (#1406), with the same contract: a label,
// `hint` between label and textarea, `children` below, and an `error`
// message under the label that turns the border red and becomes the
// textarea's accessible description. Rest props flow to the textarea.
type Props = {
	id: string;
	label: string;
	// Appends the "(optional)" tag to the label.
	optional?: boolean;
	// A different tag for the label, e.g. "(if applicable)"; wins over
	// `optional`.
	labelNote?: string;
	value?: string;
	element?: HTMLTextAreaElement;
	rows?: number;
	error?: string;
	// Taken out of the rest props so a caller's values merge with the
	// error state instead of overriding it.
	"aria-describedby"?: string;
	"aria-invalid"?: HTMLTextareaAttributes["aria-invalid"];
	hint?: Snippet;
	children?: Snippet;
	[key: string]: unknown;
};
let {
	id,
	label,
	optional = false,
	labelNote,
	value = $bindable(""),
	element = $bindable(),
	rows = 3,
	error,
	"aria-describedby": ariaDescribedby,
	"aria-invalid": ariaInvalid,
	hint,
	children,
	...rest
}: Props = $props();

const errorId = $derived(`${id}-error`);
// The error's message is read first, then any description the caller
// passed; an error always marks the textarea invalid.
const describedBy = $derived(
	[error ? errorId : undefined, ariaDescribedby].filter(Boolean).join(" ") ||
		undefined,
);
const invalid = $derived(error ? "true" : ariaInvalid);
// Red for its own error, and for one whose message lives elsewhere — a
// rule shared with another control, marked through aria-invalid.
const showInvalid = $derived(invalid === true || invalid === "true");
const note = $derived(labelNote ?? (optional ? $_("forms.optional") : ""));
</script>

<div>
	<label for={id} class="mb-2 block font-semibold">
		{label}
		{#if note}
			<span class="font-normal">{note}</span>
		{/if}
	</label>
	{#if error}
		<FieldError id={errorId} message={error} />
	{/if}
	{#if hint}
		{@render hint()}
	{/if}
	<textarea
		{id}
		{rows}
		bind:this={element}
		bind:value
		aria-invalid={invalid}
		aria-describedby={describedBy}
		class="w-full rounded-2xl border-2 {fieldBorderClasses(
			showInvalid,
		)} p-3 transition-all disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
		{...rest}
	></textarea>
	{#if children}
		{@render children()}
	{/if}
</div>
