<script lang="ts">
import { _ } from "svelte-i18n";

import { getAreaSectionContext } from "#lib/area/sectionContext.js";
import { reportError } from "#lib/store.js";
import type { AreaPageProps } from "#lib/types.js";
import AreaStats from "$components/area/AreaStats.svelte";

let { data }: { data: AreaPageProps } = $props();

const { areaReports } = getAreaSectionContext();
</script>

{#if $reportError}
	<div class="text-center text-primary dark:text-white">
		<p>{$_('area.errorLoadingData')}</p>
	</div>
{:else if $areaReports === undefined}
	<div class="text-center text-primary dark:text-white">
		<p>{$_('area.loadingData')}</p>
	</div>
{:else if $areaReports.length > 0}
	<AreaStats name={data.name} areaReports={$areaReports} areaTags={data.tags} />
{:else}
	<div class="text-center text-primary dark:text-white">
		<p class="text-xl">{$_('area.dataWithin24Hours')}</p>
	</div>
{/if}
