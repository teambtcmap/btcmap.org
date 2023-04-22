import localforage from 'localforage';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { elements, mapUpdates, elementError, mapLoading, elementsSyncCount } from '$lib/store';
import { get } from 'svelte/store';

axiosRetry(axios, { retries: 3 });

export const elementsSync = async () => {
	mapLoading.set('Checking local cache...');
	// get elements from local
	await localforage
		.getItem('elements')
		.then(async function (value) {
			// get elements from API if initial sync
			if (!value) {
				// add to sync count to only show data refresh after initial load
				let count = get(elementsSyncCount);
				elementsSyncCount.set(count + 1);

				try {
					mapLoading.set('Fetching elements...');
					const response = await axios.get('https://api.btcmap.org/v2/elements');

					if (response.data.length) {
						mapLoading.set('Storing data...');
						// set response to local
						localforage
							.setItem('elements', response.data)
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								mapLoading.set('Initial sync complete!');
								// set response to store
								elements.set(response.data);
							})
							.catch(function (err) {
								mapLoading.set('Map loading complete!');
								elements.set(response.data);
								elementError.set(
									'Could not store elements locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						elementError.set(
							'Elements API returned an empty result, please try again or contact BTC Map.'
						);
					}
				} catch (error) {
					elementError.set(
						'Could not load elements from API, please try again or contact BTC Map.'
					);
					console.log(error);
				}
			} else {
				mapLoading.set('Local cache found!');

				// add to sync count to only show data refresh after initial load
				let count = get(elementsSyncCount);
				elementsSyncCount.set(count + 1);

				// start update sync from API
				try {
					// sort to get most recent record
					let cacheSorted = [...value];
					cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

					mapLoading.set('Fetching new elements...');
					const response = await axios.get(
						`https://api.btcmap.org/v2/elements?updated_since=${cacheSorted[0]['updated_at']}`
					);

					// update new records if they exist
					let newElements = response.data;

					// check for new elements in local and purge if they exist
					if (newElements.length) {
						mapLoading.set('Storing data...');
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
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								mapLoading.set('Map loading complete!');
								// set updated elements to store
								elements.set(newElements);

								// display data refresh icon on map
								mapUpdates.set(true);
							})
							.catch(function (err) {
								// set updated elements to store
								elements.set(newElements);

								// display data refresh icon on map
								mapUpdates.set(true);

								elementError.set(
									'Could not update elements locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						mapLoading.set('Map loading complete!');
						// set cached elements to store
						elements.set(value);
					}
				} catch (error) {
					// set cached elements to store
					elements.set(value);

					elementError.set(
						'Could not update elements from API, please try again or contact BTC Map.'
					);
					console.error(error);
				}
			}
		})

		.catch(async function (err) {
			elementError.set('Could not load elements locally, please try again or contact BTC Map.');
			console.log(err);

			// add to sync count to only show data refresh after initial load
			let count = get(elementsSyncCount);
			elementsSyncCount.set(count + 1);

			try {
				mapLoading.set('Fetching elements...');
				const response = await axios.get('https://api.btcmap.org/v2/elements');

				if (response.data.length) {
					mapLoading.set('Initial sync complete!');
					// set response to store
					elements.set(response.data);
				} else {
					elementError.set(
						'Elements API returned an empty result, please try again or contact BTC Map.'
					);
				}
			} catch (error) {
				elementError.set('Could not load elements from API, please try again or contact BTC Map.');
				console.log(error);
			}
		});
};
