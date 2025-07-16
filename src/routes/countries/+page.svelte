<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Redirect to default section (Africa) when visiting /countries
	onMount(() => {
		if (browser) {
			goto('/countries/africa', { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>BTC Map - Countries</title>
	<meta property="og:image" content="https://btcmap.org/images/og/countries.png" />
	<meta property="twitter:title" content="BTC Map - Countries" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/countries.png" />
</svelte:head>

<!-- Loading state while redirecting -->
<div class="bg-teal dark:bg-dark min-h-screen flex items-center justify-center">
	<div class="text-primary dark:text-white text-xl">Loading countries...</div>
</div>