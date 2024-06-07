<script lang="ts">
	import { page } from '$app/stores';
	import { syncStatus } from '$lib/store';
	import { areasSync } from '$lib/sync/areas';
	import { elementsSync } from '$lib/sync/elements';
	import { eventsSync } from '$lib/sync/events';
	import { reportsSync } from '$lib/sync/reports';
	import { usersSync } from '$lib/sync/users';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import axios from 'axios';
	import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
	import 'leaflet.markercluster/dist/MarkerCluster.css';
	import 'leaflet/dist/leaflet.css';
	import localforage from 'localforage';
	import { onDestroy, onMount } from 'svelte';
	import 'tippy.js/dist/tippy.css';
	import '../app.css';

	axios.defaults.timeout = 600000;

	const options = {
		reversed: true,
		intro: { y: 192 },
		pausable: true
	};

	let dataSyncInterval: ReturnType<typeof setInterval>;

	onMount(async () => {
		localforage.config({
			name: 'BTC Map',
			description: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'
		});

		const dataSync = async () => {
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
	<meta
		name="lightning"
		content="lnurlp:LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34"
	/>
	<meta property="alby:image" content="/images/logo.svg" />
	<meta property="alby:name" content="BTC Map" />
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
