<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Redirect to default section (Africa) when visiting /countries
	onMount(() => {
		if (browser) {
			// Check if there's a hash in the URL from the old system
			const hash = window.location.hash;
			if (hash) {
				const section = hash.slice(1); // Remove the #
				const validSections = ['africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america'];
				
				if (validSections.includes(section)) {
					// Redirect to the new route with the section from the hash
					goto(`/countries/${section}`, { replaceState: true });
					return;
				}
			}
			
			// Default redirect to Africa
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