import localforage from 'localforage';
import axios from 'axios';
import { elements, mapUpdates, elementError } from '$lib/store';

export const elementsSync = async () => {
	// get elements from local
	await localforage
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
								elements.set(response.data);
							})
							.catch(function (err) {
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
				// load elements locally first
				elements.set(value);

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
								elements.set(newElements);

								// display data refresh icon on map
								mapUpdates.set(true);
							})
							.catch(function (err) {
								elementError.set(
									'Could not update elements locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					}
				} catch (error) {
					elementError.set(
						'Could not update elements from API, please try again or contact BTC Map.'
					);
					console.error(error);
				}
			}
		})

		.catch(function (err) {
			elementError.set('Could not load elements locally, please try again or contact BTC Map.');
			console.log(err);
		});
};
