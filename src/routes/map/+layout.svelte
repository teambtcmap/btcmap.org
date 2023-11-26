<script>
	import { MapLoading } from '$comp';
	import {
		areaError,
		areas,
		elementError,
		elements,
		mapLoading,
		reportError,
		reports
	} from '$lib/store';
	import { errToast } from '$lib/utils';

	// alert for map errors
	$: $elementError && errToast($elementError);

	// alert for area errors
	$: $areaError && errToast($areaError);

	// alert for report errors
	$: $reportError && errToast($reportError);
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/map.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/map.png" />
</svelte:head>

<h1 class="hidden">Map</h1>

{#if $elements && $elements.length && $areas && $areas.length && $reports && $reports.length}
	<slot />
{:else}
	<MapLoading type="main" message={$mapLoading} />
{/if}
