<script>
	import localforage from 'localforage';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { elementsSync } from '$lib/sync/elements';
	import { eventsSync } from '$lib/sync/events';
	import { usersSync } from '$lib/sync/users';
	import { syncStatus } from '$lib/store';

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
			$syncStatus = true;
			await elementsSync();
			await eventsSync();
			await usersSync();
			$syncStatus = false;
		};

		dataSync();
		dataSyncInterval = setInterval(dataSync, 600000);
	});

	onDestroy(() => {
		clearInterval(dataSyncInterval);
	});
</script>

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
