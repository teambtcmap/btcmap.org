<script lang="ts">
import { createEventDispatcher } from "svelte";

import {
	ACTIVITY_TYPES,
	type ActivityType,
	dotColor,
	TYPE_LABEL_KEYS,
} from "$lib/activity";
import { _ } from "$lib/i18n";

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
			class="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors {active
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
