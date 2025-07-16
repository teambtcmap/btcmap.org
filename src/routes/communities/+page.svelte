<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		if (browser) {
			// Handle legacy hash URLs and redirect to new structure
			if (location.hash) {
				const hashSection = decodeURIComponent(location.hash).slice(1);
				// Valid sections that should be redirected
				const validSections = ['africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america'];
				
				if (validSections.includes(hashSection)) {
					goto(`/communities/${hashSection}`, { replaceState: true });
					return;
				}
				
				// For organization sections, redirect as well (they'll be validated client-side)
				if (hashSection && hashSection !== 'africa') {
					goto(`/communities/${hashSection}`, { replaceState: true });
					return;
				}
			}
			
			// Default redirect to africa section
			goto('/communities/africa', { replaceState: true });
		}
	});
</script>

<!-- This page now redirects to the new communities/[section] structure -->
