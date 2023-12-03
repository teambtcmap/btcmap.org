import { elementError, elements, elementsSyncCount, mapLoading, mapUpdates } from '$lib/store';
import type { Element } from '$lib/types';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';
import { get } from 'svelte/store';

axiosRetry(axios, { retries: 3 });

const limit = 5000;

export const elementsSync = async () => {
	mapLoading.set('Checking local cache...');
	// get elements from local
	await localforage
		.getItem<Element[]>('elements')
		.then(async function (value) {
			// get elements from API if initial sync
			if (!value) {
				// add to sync count to only show data refresh after initial load
				const count = get(elementsSyncCount);
				elementsSyncCount.set(count + 1);

				let updatedSince = '2022-01-01T00:00:00.000Z';
				let responseCount;
				const elementsData: Element[] = [];

				mapLoading.set('Fetching elements...');

				do {
					try {
						const response = await axios.get<Element[]>(
							`https://api.btcmap.org/v2/elements?updated_since=${updatedSince}&limit=${limit}`
						);

						if (response.data.length) {
							updatedSince = response.data[response.data.length - 1]['updated_at'];
							responseCount = response.data.length;
							elementsData.filter(
								(element) => !response.data.find((data) => data.id === element.id)
							);
							response.data.forEach((data) => elementsData.push(data));
						} else {
							elementError.set(
								'Elements API returned an empty result, please try again or contact BTC Map.'
							);
							break;
						}
					} catch (error) {
						elementError.set(
							'Could not load elements from API, please try again or contact BTC Map.'
						);
						console.log(error);
						break;
					}
				} while (responseCount === limit);

				if (elementsData.length) {
					mapLoading.set('Storing data...');
					// set response to local
					localforage
						.setItem('elements', elementsData)
						.then(function () {
							mapLoading.set('Initial sync complete!');
							// set response to store
							elements.set(elementsData);
						})
						.catch(function (err) {
							mapLoading.set('Map loading complete!');
							elements.set(elementsData);
							elementError.set(
								'Could not store elements locally, please try again or contact BTC Map.'
							);
							console.log(err);
						});
				}
			} else {
				mapLoading.set('Local cache found!');

				// add to sync count to only show data refresh after initial load
				const count = get(elementsSyncCount);
				elementsSyncCount.set(count + 1);

				// start update sync from API
				// sort to get most recent record
				const cacheSorted = [...value];
				cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

				let updatedSince = cacheSorted[0]['updated_at'];
				let responseCount;
				const elementsData = value;
				let useCachedData = false;

				mapLoading.set('Fetching new elements...');

				do {
					try {
						const response = await axios.get<Element[]>(
							`https://api.btcmap.org/v2/elements?updated_since=${updatedSince}&limit=${limit}`
						);

						// update new records if they exist
						const newElements = response.data;

						// check for new elements in local and purge if they exist
						if (newElements.length) {
							updatedSince = newElements[newElements.length - 1]['updated_at'];
							responseCount = newElements.length;

							elementsData.filter((value) => {
								if (newElements.find((element) => element.id === value.id)) {
									return false;
								} else {
									return true;
								}
							});

							// add new elements
							newElements.forEach((element) => {
								elementsData.push(element);
							});
						} else {
							mapLoading.set('Map loading complete!');
							// set cached elements to store
							elements.set(value);
							useCachedData = true;
							break;
						}
					} catch (error) {
						// set cached elements to store
						elements.set(value);
						useCachedData = true;

						elementError.set(
							'Could not update elements from API, please try again or contact BTC Map.'
						);
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (!useCachedData) {
					// set updated elements locally
					mapLoading.set('Storing data...');

					localforage
						.setItem('elements', elementsData)
						.then(function () {
							mapLoading.set('Map loading complete!');
							// set updated elements to store
							elements.set(elementsData);

							// display data refresh icon on map
							mapUpdates.set(true);
						})
						.catch(function (err) {
							// set updated elements to store
							elements.set(elementsData);

							// display data refresh icon on map
							mapUpdates.set(true);

							elementError.set(
								'Could not update elements locally, please try again or contact BTC Map.'
							);
							console.log(err);
						});
				}
			}
		})

		.catch(async function (err) {
			elementError.set('Could not load elements locally, please try again or contact BTC Map.');
			console.log(err);

			// add to sync count to only show data refresh after initial load
			const count = get(elementsSyncCount);
			elementsSyncCount.set(count + 1);

			let updatedSince = '2022-01-01T00:00:00.000Z';
			let responseCount;
			const elementsData: Element[] = [];

			mapLoading.set('Fetching elements...');

			do {
				try {
					const response = await axios.get<Element[]>(
						`https://api.btcmap.org/v2/elements?updated_since=${updatedSince}&limit=${limit}`
					);

					if (response.data.length) {
						updatedSince = response.data[response.data.length - 1]['updated_at'];
						responseCount = response.data.length;
						elementsData.filter((element) => !response.data.find((data) => data.id === element.id));
						response.data.forEach((data) => elementsData.push(data));
					} else {
						elementError.set(
							'Elements API returned an empty result, please try again or contact BTC Map.'
						);
						break;
					}
				} catch (error) {
					elementError.set(
						'Could not load elements from API, please try again or contact BTC Map.'
					);
					console.log(error);
					break;
				}
			} while (responseCount === limit);

			if (elementsData.length) {
				mapLoading.set('Map loading complete!');
				// set response to store
				elements.set(elementsData);
			}
		});
};
