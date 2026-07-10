<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";

// Pre-formatted count from formatNearbyPillCount, e.g. "14" or ">250"
export let count: string;
// Set when the pill sits inside a control whose accessible name is computed
// from its contents (the search facade). The count is announced separately
// there, so leaving it in the tree would only destabilise that name.
export let decorative: boolean = false;
</script>

<span
	aria-hidden={decorative ? "true" : undefined}
	class="pointer-events-none inline-flex shrink-0 items-center gap-1 rounded-full bg-link px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-sm"
>
	<Icon w="12" h="12" icon="location_on" type="material" />
	{$_('search.nearbyCount', { values: { count } })}
</span>
