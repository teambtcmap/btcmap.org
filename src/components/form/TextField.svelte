<script lang="ts">
import type { Snippet } from "svelte";

import { _ } from "$lib/i18n";

// The app's one single-line text field (#1326) — one visual family, the
// public forms' field. The short-lived compact/auth style (an ad-hoc
// April choice, never a system decision) was unified away here; the auth
// forms wear this field too. Data flow follows the input type: text and
// password support two-way `bind:value` (auth validation reads the value
// reactively), every other type is read through the element ref —
// which also keeps the legacy imperative patterns (the address prefill's
// direct DOM writes) working unchanged. Rest props flow to the input
// (required, disabled, placeholder, minlength, autocomplete, …);
// `hint` renders between label and input, `children` below.
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
	hint,
	children,
	...rest
}: Props = $props();

const inputClasses = $derived(
	`w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400 ${inputClass}`,
);
</script>

<div>
	<label for={id} class="mb-2 block font-semibold">
		{label}
		{#if optional}
			<span class="font-normal">{$_('forms.optional')}</span>
		{/if}
	</label>
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
			class={inputClasses}
			{...rest}
		/>
	{:else if type === 'text'}
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
