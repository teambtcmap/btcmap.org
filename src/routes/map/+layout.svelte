<script>
	import { MapLoading } from '$comp';
	import { elements, elementError, areas, areaError, mapLoading } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/map.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/map.png" />
</svelte:head>

{#if ($elements && $elements.length && $areas && $areas.length) || $elementError || $areaError}
	<slot />
{:else}
	<MapLoading type="main" message={$mapLoading} />
{/if}
