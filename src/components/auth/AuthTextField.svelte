<script lang="ts">
import type { Snippet } from "svelte";

// The auth forms' shared label + input row (#1326): LoginForm,
// SignupForm and the nsec field all repeated this markup. Rest props
// flow to the input (minlength, placeholder, autocorrect, …) and
// `inputClass` appends per-field styling (the nsec field's mono face);
// an optional child snippet renders below the input for hints.
type Props = {
	id: string;
	label: string;
	value?: string;
	type?: "text" | "password";
	inputClass?: string;
	children?: Snippet;
	[key: string]: unknown;
};
let {
	id,
	label,
	value = $bindable(""),
	type = "text",
	inputClass = "",
	children,
	...rest
}: Props = $props();

const inputClasses = $derived(
	`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white ${inputClass}`,
);
</script>

<div>
	<label
		for={id}
		class="mb-1 block text-sm font-semibold text-primary dark:text-white"
	>
		{label}
	</label>
	<!-- Two static-typed inputs: Svelte forbids bind:value alongside a
	     dynamic type attribute. -->
	{#if type === 'password'}
		<input {id} type="password" bind:value class={inputClasses} {...rest} />
	{:else}
		<input {id} type="text" bind:value class={inputClasses} {...rest} />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</div>
