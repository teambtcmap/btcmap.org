<script>
	import { MapLoading } from '$comp';
	import { elements, elementError, mapLoading } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/map.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/map.png" />
</svelte:head>

{#if ($elements && $elements.length) || $elementError}
	<slot />
{:else}
	<MapLoading message={$mapLoading} />
{/if}
