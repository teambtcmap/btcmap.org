<script lang="ts">
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";

// Shared boost CTA card, used by the merchant detail page and the map drawer.
// The trigger differs per context, so the consumer passes `onClick`: the page
// opens the boost modal via the $boost store; the drawer opens its in-place
// boost view.
export let boosted = false;
export let boostedUntil: string | undefined = undefined;
export let loading = false;
export let onClick: () => void;
</script>

<div
	class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-700/30 dark:bg-amber-900/10"
>
	<div class="flex items-start gap-3">
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
		>
			<Icon
				w="20"
				h="20"
				class="text-amber-600 dark:text-amber-400"
				icon={boosted ? 'auto_awesome' : 'rocket_launch'}
				type="material"
			/>
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold text-amber-800 dark:text-amber-300">
				{boosted ? $_('boost.boosted') : $_('boost.getVisibility')}
			</p>
			{#if boosted && boostedUntil}
				<p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400/80">
					{$_('boost.expires')}:
					<Time live={3000} relative={true} timestamp={boostedUntil} />
				</p>
			{:else}
				<p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400/80">
					{$_('boost.boostPromo')}
				</p>
			{/if}
		</div>
	</div>
	<button
		type="button"
		on:click={onClick}
		disabled={loading}
		class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 {boosted
			? 'border border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-600/40 dark:text-amber-300 dark:hover:bg-amber-900/30'
			: 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500'}"
	>
		{#if loading}
			{$_('boost.boosting')}
		{:else}
			<Icon
				w="16"
				h="16"
				class="shrink-0"
				icon={boosted ? 'arrow_circle_up' : 'rocket_launch'}
				type="material"
			/>
			{boosted ? $_('boost.extendBoost') : $_('boost.boostThisPlace')}
		{/if}
	</button>
</div>
