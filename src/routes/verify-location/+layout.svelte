<script lang="ts">
	import { LoadingSplash } from '$lib/comp';
	import { elements } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map - Verify Location</title>
	<meta property="og:image" content="https://btcmap.org/images/og/verify.png" />
	<meta property="twitter:title" content="BTC Map - Verify Location" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/verify.png" />
</svelte:head>

{#if $elements && $elements.length}
	<slot />
{:else}
	<LoadingSplash page="map" />
{/if}
