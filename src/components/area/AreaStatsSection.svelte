<script lang="ts">
import { _ } from "svelte-i18n";

import AreaStats from "$components/area/AreaStats.svelte";
import { getAreaSectionContext } from "$lib/area/sectionContext";
import type { AreaPageProps } from "$lib/types";

let { data }: { data: AreaPageProps } = $props();

const { areaReports, reportsError } = getAreaSectionContext();
</script>

{#if $reportsError}
	<div class="text-center text-primary dark:text-white">
		<p>{$_('area.errorLoadingData')}</p>
	</div>
{:else if $areaReports.length > 0}
	<AreaStats name={data.name} areaReports={$areaReports} areaTags={data.tags} />
{:else}
	<div class="text-center text-primary dark:text-white">
		<p class="text-xl">{$_('area.dataWithin24Hours')}</p>
	</div>
{/if}
