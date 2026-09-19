<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLInputAttributes } from "svelte/elements";

import FieldError from "$components/form/FieldError.svelte";
import { fieldBorderClasses } from "$lib/fieldStyles";
import { _ } from "$lib/i18n";

// The app's one single-line text field (#1326) — one visual family, the
// public forms' field. The short-lived compact/auth style (an ad-hoc
// April choice, never a system decision) was unified away here; the auth
// forms wear this field too. Data flow follows the input type: text and
// password support two-way `bind:value` (auth validation reads the value
// reactively), every other type is read through the element ref —
// which also keeps the legacy imperative patterns working unchanged; a
// form library can still drive them one way through `value` (#1420).
// Rest props flow to the input
// (required, disabled, placeholder, minlength, autocomplete, …);
// `hint` renders between label and input, `children` below. `error` is
// the form's own validation message (#1404): shown under the label, it
// turns the border red and becomes the input's accessible description.
// TextArea is the multi-line sibling with the same contract.
type Props = {
	id: string;
	label: string;
	// Appends the "(optional)" tag to the label.
	optional?: boolean;
	value?: string;
	element?: HTMLInputElement;
	type?: "text" | "password" | "email" | "url" | "tel";
	// Per-field extras on top of the base input classes (e.g. the nsec
	// field's mono face).
	inputClass?: string;
	error?: string;
	// Taken out of the rest props so a caller's values merge with the
	// error state instead of overriding it.
	"aria-describedby"?: string;
	"aria-invalid"?: HTMLInputAttributes["aria-invalid"];
	hint?: Snippet;
	children?: Snippet;
	[key: string]: unknown;
};
let {
	id,
	label,
	optional = false,
	value = $bindable(""),
	element = $bindable(),
	type = "text",
	inputClass = "",
	error,
	"aria-describedby": ariaDescribedby,
	"aria-invalid": ariaInvalid,
	hint,
	children,
	...rest
}: Props = $props();

const errorId = $derived(`${id}-error`);
// The error's message is read first, then any description the caller
// passed; an error always marks the input invalid.
const describedBy = $derived(
	[error ? errorId : undefined, ariaDescribedby].filter(Boolean).join(" ") ||
		undefined,
);
const invalid = $derived(error ? "true" : ariaInvalid);
// Red for its own error, and for one whose message lives elsewhere — a
// rule shared with another control, marked through aria-invalid.
const showInvalid = $derived(invalid === true || invalid === "true");
const inputClasses = $derived(
	`w-full rounded-2xl border-2 ${fieldBorderClasses(showInvalid)} p-3 transition-all disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400 ${inputClass}`,
);
</script>

<div>
	<label for={id} class="mb-2 block font-semibold">
		{label}
		{#if optional}
			<span class="font-normal">{$_('forms.optional')}</span>
		{/if}
	</label>
	{#if error}
		<FieldError id={errorId} message={error} />
	{/if}
	{#if hint}
		{@render hint()}
	{/if}
	<!-- bind:value needs a static type attribute — hence the explicit
	     text/password branches; other types are read via the element ref. -->
	{#if type === 'password'}
		<input
			{id}
			type="password"
			bind:this={element}
			bind:value
			aria-invalid={invalid}
			aria-describedby={describedBy}
			class={inputClasses}
			{...rest}
		/>
	{:else if type === 'text'}
		<input
			{id}
			type="text"
			bind:this={element}
			bind:value
			aria-invalid={invalid}
			aria-describedby={describedBy}
			class={inputClasses}
			{...rest}
		/>
	{:else}
		<input
			{id}
			{type}
			{value}
			bind:this={element}
			aria-invalid={invalid}
			aria-describedby={describedBy}
			class={inputClasses}
			{...rest}
		/>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</div>
