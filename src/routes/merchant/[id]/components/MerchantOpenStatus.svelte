<script lang="ts">
import { onDestroy, onMount } from "svelte";

import { _, locale } from "$lib/i18n";
import { getOpenStatus } from "$lib/openingHoursStatus";

// Live open/closed pill, matching the map drawer (MerchantDetailsContent).
// Reuses the shared, timezone-aware getOpenStatus helper.
export let hours: string | undefined = undefined;
export let lat: number;
export let long: number;

$: coords = { lat, lon: long };
$: openStatus = getOpenStatus(hours, coords);

// Keep the badge accurate without a reload (same cadence as the drawer).
let timer: ReturnType<typeof setInterval>;
onMount(() => {
	timer = setInterval(() => {
		openStatus = getOpenStatus(hours, coords);
	}, 60_000);
});
onDestroy(() => clearInterval(timer));

const fmtTime = (d: Date) =>
	d.toLocaleTimeString($locale || undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
</script>

{#if openStatus}
	<span
		class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {openStatus.isOpen
			? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
			: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}"
	>
		{openStatus.isOpen ? $_('merchant.openNow') : $_('merchant.closed')}
		{#if openStatus.nextChange}
			<span class="ml-1">
				· {openStatus.isOpen
					? $_('merchant.closesAt', { values: { time: fmtTime(openStatus.nextChange) } })
					: $_('merchant.opensAt', { values: { time: fmtTime(openStatus.nextChange) } })}
			</span>
		{/if}
	</span>
{/if}
