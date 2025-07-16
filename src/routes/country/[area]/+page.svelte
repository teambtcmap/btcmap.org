<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { AreaPageProps } from '$lib/types';

	export let data: AreaPageProps;

	const { id } = data;

	// Redirect to default section (merchants) when visiting /country/[area]
	onMount(() => {
		if (browser) {
			// Check if there's a hash in the URL from the old system
			const hash = window.location.hash;
			if (hash) {
				const section = hash.slice(1); // Remove the #
				const validSections = ['merchants', 'stats', 'activity', 'maintain'];
				
				if (validSections.includes(section)) {
					// Redirect to the new route with the section from the hash
					goto(`/country/${id}/${section}`, { replaceState: true });
					return;
				}
			}
			
			// Default redirect to merchants
			goto(`/country/${id}/merchants`, { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>{data.name ? data.name + ' - ' : ''}BTC Map Country</title>
	<meta property="og:image" content="https://btcmap.org/images/og/countries.png" />
	<meta property="twitter:title" content="{data.name ? data.name + ' - ' : ''}BTC Map Country" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/countries.png" />
</svelte:head>

<!-- Loading state while redirecting -->
<div class="bg-teal dark:bg-dark min-h-screen flex items-center justify-center">
	<div class="text-primary dark:text-white text-xl">Loading country...</div>
</div>