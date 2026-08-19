<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { ISSUE_PIN_VARIANTS, PIN_FILLS } from "$lib/map/maplibreSprites";
import type { DerivedIssueCode } from "$lib/placeIssues";
import { DERIVED_ISSUE_CODES } from "$lib/placeIssues";

// The ?issues-mode bar (#921, layout per the Claude Design wireframe):
// mobile renders a fixed-height card — title + live in-view count + exit on
// one line, chips on a single sideways-scrolling row (fade + chevron as the
// scroll affordance) — anchored above the search sheet so the two cards
// read as one column. Desktop lays the same pieces out as a single row
// spanning the map area. The exit is a labeled "Show all places" pill, not
// a bare ✕: a ✕ reads as "hide this panel" when it actually drops the
// filter. Chip styling mirrors ActivityTypeFilter; dots carry pin colors.
// Counts are null until the verified_at enrichment lands.
type Props = {
	selected: ReadonlySet<DerivedIssueCode>;
	counts: Record<DerivedIssueCode, number> | null;
	totalInView: number | null;
	onToggle: (code: DerivedIssueCode) => void;
	onExit: () => void;
};

let { selected, counts, totalInView, onToggle, onExit }: Props = $props();
</script>

{#snippet showAllPill(extra: string)}
	<button
		type="button"
		onclick={onExit}
		class="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 text-xs font-semibold whitespace-nowrap text-body transition-colors hover:border-link hover:text-link focus-visible:ring-2 focus-visible:ring-link focus-visible:outline-none dark:border-white/20 dark:bg-white/5 dark:text-white/80 dark:hover:border-link dark:hover:text-white {extra}"
	>
		<Icon w="12" h="12" icon="close" type="material" />
		{$_('issuesMode.showAll')}
	</button>
{/snippet}

<div
	class="pointer-events-auto w-full rounded-lg bg-white shadow-lg md:flex md:items-center md:gap-2 md:py-2 md:pr-2 md:pl-3 dark:bg-dark dark:shadow-black/30"
	role="group"
	aria-label={$_('issuesMode.title')}
>
	<div class="flex min-w-0 items-center gap-2 px-3 pt-2.5 pb-2 md:shrink-0 md:p-0">
		<Icon
			w="15"
			h="15"
			icon="warning"
			type="material"
			class="shrink-0 text-body dark:text-white/70"
		/>
		<span class="shrink-0 text-sm font-semibold text-primary dark:text-white">
			{$_('issuesMode.title')}
		</span>
		{#if totalInView != null}
			<span
				class="truncate text-xs text-body dark:text-white/60"
				aria-live="polite"
				aria-atomic="true"
			>
				· {$_('issuesMode.inView', { values: { count: totalInView } })}
			</span>
		{/if}
		{@render showAllPill('ml-auto md:hidden')}
	</div>

	<div class="relative min-w-0 md:flex-1">
		<div
			class="flex items-center gap-2 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] md:p-0"
		>
			{#each DERIVED_ISSUE_CODES as code (code)}
				{@const active = selected.has(code)}
				<button
					type="button"
					aria-pressed={active}
					onclick={() => onToggle(code)}
					class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-dark {active
						? 'border-link bg-link/10 text-primary dark:border-link dark:text-white'
						: 'border-gray-300 text-body hover:border-link dark:border-white/20 dark:text-white/80 dark:hover:text-white'}"
				>
					<span
						class="h-2 w-2 rounded-full {active ? '' : 'opacity-40'}"
						style="background-color: {PIN_FILLS[ISSUE_PIN_VARIANTS[code]]}"
					></span>
					<span>{$_(`issuesMode.chips.${code}`)}</span>
					{#if counts}
						<span class="text-xs">({counts[code]})</span>
					{/if}
				</button>
			{/each}
		</div>
		<!-- Sideways-scroll affordance (mobile only): the fade plus a chevron
			over the clipped edge signal more chips to the right. -->
		<div
			class="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-br-lg bg-gradient-to-r from-transparent to-white md:hidden dark:to-dark"
		></div>
		<div class="pointer-events-none absolute top-1/2 right-1 -translate-y-[60%] md:hidden">
			<Icon
				w="14"
				h="14"
				icon="chevron_right"
				type="material"
				class="text-body/60 dark:text-white/50"
			/>
		</div>
	</div>

	{@render showAllPill('hidden md:flex')}
</div>
