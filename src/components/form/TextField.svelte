<script lang="ts">
import type { Snippet } from "svelte";

import { _ } from "$lib/i18n";

// The app's one single-line text field (#1326), in its two visual
// families: `form` is the public forms' large rounded field (uncontrolled
// — callers read the element ref, preserving the legacy imperative
// patterns like the address prefill), `compact` is the auth cards' dense
// field (controlled via bind:value for reactive validation). Rest props
// flow to the input (required, disabled, placeholder, minlength,
// autocomplete, …); `hint` renders between label and input, `children`
// below the input.
type Props = {
	id: string;
	label: string;
	// Appends the "(optional)" tag to the label — the public forms' idiom.
	optional?: boolean;
	value?: string;
	element?: HTMLInputElement;
	type?: "text" | "password" | "email" | "url" | "tel";
	variant?: "form" | "compact";
	// Per-field extras on top of the variant's input classes (e.g. the
	// nsec field's mono face).
	inputClass?: string;
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
	variant = "form",
	inputClass = "",
	hint,
	children,
	...rest
}: Props = $props();

const labelClasses = $derived(
	variant === "compact"
		? "mb-1 block text-sm font-semibold text-primary dark:text-white"
		: "mb-2 block font-semibold",
);
const inputClasses = $derived(
	`${
		variant === "compact"
			? "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
			: "w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
	} ${inputClass}`,
);
</script>

<div>
	<label for={id} class={labelClasses}>
		{label}
		{#if optional}
			<span class="font-normal">{$_('forms.optional')}</span>
		{/if}
	</label>
	{#if hint}
		{@render hint()}
	{/if}
	<!-- Controlled inputs need a static type attribute for bind:value —
	     hence the password/text branches; the uncontrolled form variant
	     spreads any type. -->
	{#if variant === 'compact' && type === 'password'}
		<input
			{id}
			type="password"
			bind:this={element}
			bind:value
			class={inputClasses}
			{...rest}
		/>
	{:else if variant === 'compact'}
		<input
			{id}
			type="text"
			bind:this={element}
			bind:value
			class={inputClasses}
			{...rest}
		/>
	{:else}
		<input {id} {type} bind:this={element} class={inputClasses} {...rest} />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</div>
