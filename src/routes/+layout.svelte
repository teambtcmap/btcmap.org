<script lang="ts">
	import { syncStatus } from '$lib/store';
	import { elementsSync } from '$lib/sync/places';
	import Header from '$components/layout/Header.svelte';
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
	import Footer from '$components/layout/Footer.svelte';

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

			// Load places (map is primary use case)
			// Other syncs (events, users, areas, reports) are lazy-loaded by pages that need them
			await elementsSync();

			$syncStatus = false;
		};

		dataSync();
		dataSyncInterval = setInterval(dataSync, 600000);
	});

	onDestroy(() => {
		clearInterval(dataSyncInterval);
	});

	export let data;
</script>

<svelte:head>
	<meta
		name="lightning"
		content="lnurlp:LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34"
	/>
	<meta property="alby:image" content="/images/logo.svg" />
	<meta property="alby:name" content="BTC Map" />
</svelte:head>

{#if !['/', '/map', '/communities/map', '/communities', '/countries'].includes(data.pathname)}
	<div class="bg-teal dark:bg-dark">
		<Header />
		<div class="mx-auto w-10/12 xl:w-[1200px]">
			<slot />
			<Footer />
		</div>
	</div>
{:else}
	<slot />
{/if}

<SvelteToast {options} />

<style>
	:root {
		--toastContainerTop: auto;
		--toastContainerRight: auto;
		--toastContainerBottom: 8rem;
		--toastContainerLeft: calc(50vw - 8rem);
	}
</style>
