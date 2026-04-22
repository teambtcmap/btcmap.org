<script lang="ts">
import { createEventDispatcher } from "svelte";

import {
	ACTIVITY_TYPES,
	type ActivityType,
	dotColor,
	TYPE_LABEL_KEYS,
} from "$lib/activity";
import { _ } from "$lib/i18n";

// activeTypes is intended for two-way binding: `bind:activeTypes` in
// the parent. The component reassigns the Set on each toggle, so the
// parent's binding always sees the new value.
//
// A `change` event is dispatched on every toggle as a *separate*
// channel — consumers that only care about "user changed the filter,
// run a side effect" (e.g. resetting pagination) can `on:change`
// without adding a reactive dependency on activeTypes. Svelte 4 has
// no clean single-channel way to express "run a side effect when a
// bound prop is written", hence the two-channel API.
export let activeTypes: Set<ActivityType>;
export let counts: Record<ActivityType, number>;
// When false, the trailing "(N)" suffix on each chip is hidden. Used
// during the first feed fetch where counts are uniformly zero and
// would otherwise misleadingly imply "nothing to filter".
export let showCounts = true;

const dispatch = createEventDispatcher<{ change: undefined }>();

function toggle(type: ActivityType) {
	const next = new Set(activeTypes);
	if (next.has(type)) next.delete(type);
	else next.add(type);
	activeTypes = next;
	dispatch("change");
}
</script>

<div class="flex flex-wrap items-center justify-center gap-2">
	{#each ACTIVITY_TYPES as type (type)}
		{@const active = activeTypes.has(type)}
		<button
			type="button"
			aria-pressed={active}
			on:click={() => toggle(type)}
			class="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark {active
				? 'border-link bg-link/10 text-primary dark:border-link dark:text-white'
				: 'border-gray-300 text-body/60 hover:border-link hover:text-body dark:border-white/20 dark:text-white/50 dark:hover:text-white'}"
		>
			<span class="h-2 w-2 rounded-full {dotColor(type)}" />
			<span>{$_(TYPE_LABEL_KEYS[type])}</span>
			{#if showCounts}
				<span class="text-xs opacity-70">({counts[type]})</span>
			{/if}
		</button>
	{/each}
</div>
