<script>
	import localforage from 'localforage';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { elementsSync } from '$lib/sync/elements';
	import { eventsSync } from '$lib/sync/events';
	import { usersSync } from '$lib/sync/users';
	import { areasSync } from '$lib/sync/areas';
	import { reportsSync } from '$lib/sync/reports';
	import { syncStatus, mapLoading } from '$lib/store';

	const options = {
		reversed: true,
		intro: { y: 192 },
		pausable: true
	};

	let dataSyncInterval;

	onMount(async () => {
		localforage.config({
			name: 'BTC Map',
			description: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'
		});

		const dataSync = async () => {
			$mapLoading = 'Starting data sync...';
			$syncStatus = true;

			await Promise.allSettled([
				elementsSync(),
				eventsSync(),
				usersSync(),
				areasSync(),
				reportsSync()
			]).then((results) => results.forEach((result) => console.log(result.status)));

			$syncStatus = false;
		};

		dataSync();
		dataSyncInterval = setInterval(dataSync, 600000);
	});

	onDestroy(() => {
		clearInterval(dataSyncInterval);
	});
</script>

<svelte:head>
	{#if !$page.url.pathname.startsWith('/tagger') && !$page.url.pathname.startsWith('/community') && !$page.url.pathname.startsWith('/merchant')}
		<meta
			name="lightning"
			content="lnurlp:LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34"
		/>
		<meta property="alby:image" content="/images/logo.svg" />
		<meta property="alby:name" content="BTC Map" />
	{/if}
</svelte:head>

<slot />
<SvelteToast {options} />

<style>
	:root {
		--toastContainerTop: auto;
		--toastContainerRight: auto;
		--toastContainerBottom: 8rem;
		--toastContainerLeft: calc(50vw - 8rem);
	}
</style>
