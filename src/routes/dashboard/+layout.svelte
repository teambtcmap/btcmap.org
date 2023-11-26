<script>
	import { LoadingSplash } from '$comp';
	import { reportError, reports } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map - Dashboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/dash.png" />
	<meta property="twitter:title" content="BTC Map - Dashboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/dash.png" />
</svelte:head>

{#if ($reports && $reports.length) || $reportError}
	<slot />
{:else}
	<LoadingSplash page="dashboard" />
{/if}
