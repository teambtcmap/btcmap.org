<script>
	import { elements, elementError, reportShowMap } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map - Edit Location</title>
	<meta property="og:image" content="https://btcmap.org/images/og/edit.png" />
	<meta property="twitter:title" content="BTC Map - Edit Location" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/edit.png" />
</svelte:head>

{#if ($elements && $elements.length) || $elementError || !$reportShowMap}
	<slot />
{/if}
