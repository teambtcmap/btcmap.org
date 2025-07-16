<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		if (browser) {
			goto('/communities/africa', { replaceState: true });
		}
	});
</script>

<!-- This page now redirects to the new communities/[section] structure -->
