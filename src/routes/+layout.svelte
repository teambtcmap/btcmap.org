<script>
	import localforage from 'localforage';
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { elements, mapUpdates, mapError } from '$lib/store';

	let dataSyncInterval;

	onMount(async () => {
		const axios = await import('axios');

		localforage.config({
			name: 'BTC Map',
			description: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'
		});

		const dataSync = () => {
			// get elements from local
			localforage
				.getItem('elements')
				.then(async function (value) {
					// get elements from API if initial sync
					if (!value) {
						try {
							const response = await axios.get('https://api.btcmap.org/v2/elements');

							if (response.data.length) {
								// set response to local
								localforage
									.setItem('elements', response.data)
									.then(function (value) {
										// set response to store
										$elements = response.data;
									})
									.catch(function (err) {
										$mapError =
											'Could not store elements locally, please try again or contact BTC Map.';
										console.log(err);
									});
							} else {
								$mapError =
									'Elements API returned an empty result, please try again or contact BTC Map.';
							}
						} catch (error) {
							$mapError = 'Could not load elements from API, please try again or contact BTC Map.';
							console.log(error);
						}
					} else {
						// load elements locally first
						$elements = value;

						// start update sync from API
						try {
							const response = await axios.get(
								`https://api.btcmap.org/v2/elements?updated_since=${value[0]['updated_at']}`
							);

							// update new records if they exist
							let newElements = response.data;

							// check for new elements in local and purge if they exist
							if (newElements.length) {
								let updatedElements = value.filter((value) => {
									if (newElements.find((element) => element.id === value.id)) {
										return false;
									} else {
										return true;
									}
								});

								// add new elements
								updatedElements.forEach((element) => {
									newElements.push(element);
								});

								// set updated elements locally
								localforage
									.setItem('elements', newElements)
									.then(function (value) {
										// set updated elements to store
										$elements = newElements;

										// display data refresh icon on map
										$mapUpdates = true;
									})
									.catch(function (err) {
										$mapError =
											'Could not update elements locally, please try again or contact BTC Map.';
										console.log(err);
									});
							}
						} catch (error) {
							$mapError =
								'Could not update elements from API, please try again or contact BTC Map.';
							console.error(error);
						}
					}
				})

				.catch(function (err) {
					$mapError = 'Could not load elements locally, please try again or contact BTC Map.';
					console.log(err);
				});
		};

		dataSync();
		dataSyncInterval = setInterval(dataSync, 600000);
	});

	onDestroy(() => {
		clearInterval(dataSyncInterval);
	});
</script>

<slot />
