<script lang="ts">
import DOMPurify from "dompurify";
import type { HTMLInputAttributes } from "svelte/elements";

import FieldError from "$components/form/FieldError.svelte";
import Icon from "$components/Icon.svelte";
import { fieldBorderClasses } from "$lib/fieldStyles";
import { _ } from "$lib/i18n";

// The captcha block the public forms share (#1406): label, refresh, the
// image and the answer input, with the inline error of #1404 for a
// missing answer. Presentational — the form owns the fetch, the secret
// and when to refresh (add-location fetches lazily on its review step,
// the others on mount). A wrong answer is the server's call and stays a
// toast in the form.
type Props = {
	// The server's SVG. Rendered with {@html}, so it's sanitized here, at
	// the sink, whatever the caller did.
	content: string;
	loading: boolean;
	onrefresh: () => void;
	disabled?: boolean;
	// Submitted without an answer.
	invalid?: boolean;
	value?: string;
	element?: HTMLInputElement;
	oninput?: HTMLInputAttributes["oninput"];
	id?: string;
};
let {
	content,
	loading,
	onrefresh,
	disabled = false,
	invalid = false,
	value = $bindable(""),
	element = $bindable(),
	oninput,
	id = "captcha",
}: Props = $props();

const errorId = $derived(`${id}-error`);
</script>

<div>
	<div class="mb-2 flex items-center space-x-2">
		<label for={id} class="font-semibold"
			>{$_('forms.captcha')}
			<span class="font-normal">({$_('forms.captchaCaseSensitive')})</span></label
		>
		<!-- Visible whenever a (re)fetch is possible — a failed first fetch
		     must leave a retry, or the user is stranded with a disabled
		     submit. -->
		{#if !loading}
			<button type="button" onclick={onrefresh}>
				<Icon type="fa" icon="arrows-rotate" w="16" h="16" />
			</button>
		{/if}
	</div>
	{#if invalid}
		<FieldError id={errorId} message={$_('forms.captchaRequired')} />
	{/if}
	<div class="space-y-2">
		<div class="flex items-center justify-center rounded-2xl border-2 border-input py-1">
			{#if loading}
				<div class="h-[100px] w-[275px] animate-pulse bg-link/50"></div>
			{:else}
				{@html DOMPurify.sanitize(content)}
			{/if}
		</div>
		<input
			{disabled}
			required
			type="text"
			name="captcha"
			{id}
			placeholder={$_('forms.captchaPlaceholder')}
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={invalid ? errorId : undefined}
			{oninput}
			class="w-full rounded-2xl border-2 {fieldBorderClasses(
				invalid,
			)} p-3 transition-all disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
			bind:this={element}
			bind:value
		/>
	</div>
</div>
