<script lang="ts">
import AreaMap from "$components/area/AreaMap.svelte";
import AreaMerchantHighlights from "$components/area/AreaMerchantHighlights.svelte";
import Boost from "$components/Boost.svelte";
import { getAreaSectionContext } from "$lib/area/sectionContext";
import type { AreaPageProps } from "$lib/types";

import { browser } from "$app/environment";

let { data }: { data: AreaPageProps } = $props();

const { filteredPlaces, sweepDone, areaReports } = getAreaSectionContext();
</script>

<AreaMap
	name={data.name}
	geoJSON={data.tags?.geo_json}
	filteredPlaces={$filteredPlaces}
	cameraBbox={data.cameraBbox}
	upToDatePercent={$areaReports?.[0]?.tags.up_to_date_percent}
/>
<!-- Gate on sweep completion: an empty filteredPlaces mid-sweep is
     "still loading", not "no merchants here". -->
<AreaMerchantHighlights
	dataInitialized={$sweepDone}
	filteredPlaces={$filteredPlaces}
/>
{#if browser}
	<Boost />
{/if}
