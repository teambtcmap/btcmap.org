<script lang="ts">
	import { MapLoading } from '$lib/comp';
	import { elementError, elements, mapLoading } from '$lib/store';
	import { errToast } from '$lib/utils';

	// alert for map errors
	$: $elementError && errToast($elementError);
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/map.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/map.png" />
</svelte:head>

<h1 class="hidden">Map</h1>

{#if $elements && $elements.length}
	<slot />
{:else}
	<MapLoading type="main" message={$mapLoading} />
{/if}
