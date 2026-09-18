<script module lang="ts">
export type FormSelectOption = {
	value: string;
	label: string;
	// Optional group label — options sharing the same group are rendered
	// under a disabled separator row (── {group} ──). Keeps the visual
	// hierarchy of <optgroup> without its Chromium/Linux dark-mode quirk.
	//
	// Contract: pass at least one ungrouped option (or a placeholder)
	// before any grouped options. Group separator rows are rendered as
	// `<option disabled>` and must not be the first item — otherwise the
	// select could default-select the disabled row on mount.
	group?: string;
};
</script>

<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLSelectAttributes } from "svelte/elements";

type Props = {
	value?: string;
	element?: HTMLSelectElement;
	id?: string;
	name?: string;
	disabled?: boolean;
	required?: boolean;
	ariaLabel?: string;
	// Error state from the host form's own validation (#1404): a red
	// border, aria-invalid, and the id of the message that describes it.
	invalid?: boolean;
	ariaDescribedby?: string;
	style?: string;
	// When provided, options render automatically — ungrouped first, then
	// groups separated by disabled-option rows. When omitted, falls back to
	// `children` so consumers that hand-roll their <option> markup keep
	// working.
	options?: FormSelectOption[];
	onchange?: HTMLSelectAttributes["onchange"];
	children?: Snippet;
};
let {
	value = $bindable(),
	element = $bindable(),
	id,
	name,
	disabled = false,
	required = false,
	ariaLabel,
	invalid = false,
	ariaDescribedby,
	style = "",
	options,
	onchange,
	children,
}: Props = $props();

const grouped = $derived(options ? partition(options) : null);

function partition(opts: FormSelectOption[]) {
	const ungrouped: FormSelectOption[] = [];
	const groups = new Map<string, FormSelectOption[]>();
	for (const opt of opts) {
		if (opt.group) {
			const bucket = groups.get(opt.group) ?? [];
			bucket.push(opt);
			groups.set(opt.group, bucket);
		} else {
			ungrouped.push(opt);
		}
	}
	return { ungrouped, groups };
}
</script>

<select
	bind:this={element}
	{id}
	{name}
	{disabled}
	{required}
	aria-label={ariaLabel}
	aria-invalid={invalid ? 'true' : undefined}
	aria-describedby={ariaDescribedby}
	bind:value
	{onchange}
	class="w-full rounded-2xl border-2 {invalid
		? 'border-error'
		: 'border-input'} bg-white px-2 py-3 text-primary transition-all focus:outline-link
		disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500
		dark:bg-white/[0.15] dark:text-white dark:disabled:bg-gray-700 dark:disabled:text-gray-400
		{style}"
>
	{#if grouped}
		{#each grouped.ungrouped as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
		{#each [...grouped.groups] as [groupLabel, groupOpts] (groupLabel)}
			<option disabled>── {groupLabel} ──</option>
			{#each groupOpts as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		{/each}
	{:else if children}
		{@render children()}
	{/if}
</select>

<style>
	/* Dark-mode workaround for native <select> dropdowns.
	 * Chromium/Linux renders the open popup (and especially <optgroup>
	 * label rows) with OS-native light colours even when the page is
	 * dark. Applied globally so every <select> on any page that imports
	 * FormSelect inherits the fix — matches the inline workaround in
	 * IssuesTable.svelte / AreaLeaderboard.svelte.
	 *
	 * Scoped to :not(:disabled) so the browser's default dim styling
	 * for disabled options (separators / placeholders) is preserved —
	 * otherwise they'd look selectable in dark mode. */
	:global(.dark select option:not(:disabled)),
	:global(.dark select optgroup) {
		background-color: rgb(55 65 81); /* gray-700 */
		color: white;
	}
</style>
