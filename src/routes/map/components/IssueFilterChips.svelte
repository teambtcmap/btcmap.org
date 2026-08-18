<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { ISSUE_PIN_VARIANTS, PIN_FILLS } from "$lib/map/maplibreSprites";
import type { DerivedIssueCode } from "$lib/placeIssues";
import { DERIVED_ISSUE_CODES } from "$lib/placeIssues";

// The ?issues-mode header: names the mode (there is no other visible
// indicator), one toggle chip per issue category with its viewport count,
// and the exit control. Chip styling mirrors ActivityTypeFilter so filter
// chips read the same across the app; the dots carry the pin colors.
// Counts are null until the verified_at enrichment lands — chips render
// without numbers rather than all-zero.
type Props = {
	selected: ReadonlySet<DerivedIssueCode>;
	counts: Record<DerivedIssueCode, number> | null;
	onToggle: (code: DerivedIssueCode) => void;
	onExit: () => void;
};

let { selected, counts, onToggle, onExit }: Props = $props();
</script>

<!-- Container matches MapSearchBar's card (rounded-lg / bg-white / shadow-lg)
	so the two stacked bars read as one family; the chips inside mirror
	ActivityTypeFilter. -->
<div
	class="pointer-events-auto flex max-w-full items-center gap-2 rounded-lg bg-white py-2 pr-2 pl-3 shadow-lg dark:bg-dark dark:shadow-black/30"
	role="group"
	aria-label={$_('issuesMode.title')}
>
	<span
		class="flex shrink-0 items-center gap-1 text-xs font-semibold tracking-wide text-body uppercase dark:text-white/70"
	>
		<Icon w="14" h="14" icon="warning" type="material" />
		<span class="hidden sm:inline">{$_('issuesMode.title')}</span>
	</span>

	<div class="flex items-center gap-2 overflow-x-auto">
		{#each DERIVED_ISSUE_CODES as code (code)}
			{@const active = selected.has(code)}
			<button
				type="button"
				aria-pressed={active}
				onclick={() => onToggle(code)}
				class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-dark {active
					? 'border-link bg-link/10 text-primary dark:border-link dark:text-white'
					: 'border-gray-300 text-body/60 hover:border-link hover:text-body dark:border-white/20 dark:text-white/50 dark:hover:text-white'}"
			>
				<span
					class="h-2 w-2 rounded-full"
					style="background-color: {PIN_FILLS[ISSUE_PIN_VARIANTS[code]]}"
				></span>
				<span>{$_(`issuesMode.chips.${code}`)}</span>
				{#if counts}
					<span class="text-xs opacity-70">({counts[code]})</span>
				{/if}
			</button>
		{/each}
	</div>

	<button
		type="button"
		onclick={onExit}
		aria-label={$_('issuesMode.exit')}
		class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-body transition-colors hover:bg-gray-200 dark:text-white/70 dark:hover:bg-white/10"
	>
		<Icon w="16" h="16" icon="close" type="material" />
	</button>
</div>
