<script lang="ts">
	import { MapLoading } from '$lib/comp';
	import { areaError, areas, reportError, reports } from '$lib/store';
	import { errToast } from '$lib/utils';

	// alert for area errors
	$: $areaError && errToast($areaError);

	// alert for report errors
	$: $reportError && errToast($reportError);
</script>

<svelte:head>
	<title>BTC Map - Community Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="BTC Map - Community Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<h1 class="hidden">Community Map</h1>

{#if $areas && $areas.length && $reports && $reports.length}
	<slot />
{:else}
	<MapLoading type="main" message="Loading community map..." />
{/if}
