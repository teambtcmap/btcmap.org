import localforage from 'localforage';
import axios from 'axios';
import { areas, areaError } from '$lib/store';

export const areasSync = async () => {
	// get areas from local
	await localforage
		.getItem('areas')
		.then(async function (value) {
			// get areas from API if initial sync
			if (!value) {
				try {
					const response = await axios.get('https://api.btcmap.org/v2/areas');

					if (response.data.length) {
						// filter out deleted areas
						const areasFiltered = response.data.filter((area) => !area['deleted_at']);

						// set response to local
						localforage
							.setItem('areas', response.data)
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								// set response to store
								areas.set(areasFiltered);
							})
							.catch(function (err) {
								areas.set(areasFiltered);
								areaError.set(
									'Could not store areas locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						areaError.set(
							'Areas API returned an empty result, please try again or contact BTC Map.'
						);
					}
				} catch (error) {
					areaError.set('Could not load areas from API, please try again or contact BTC Map.');
					console.log(error);
				}
			} else {
				// filter out deleted areas
				const areasFiltered = value.filter((area) => !area['deleted_at']);

				// start update sync from API
				try {
					// sort to get most recent record
					let cacheSorted = [...value];
					cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

					const response = await axios.get(
						`https://api.btcmap.org/v2/areas?updated_since=${cacheSorted[0]['updated_at']}`
					);

					// update new records if they exist
					let newAreas = response.data;

					// check for new areas in local and purge if they exist
					if (newAreas.length) {
						let updatedAreas = value.filter((value) => {
							if (newAreas.find((area) => area.id === value.id)) {
								return false;
							} else {
								return true;
							}
						});

						// add new areas
						updatedAreas.forEach((area) => {
							newAreas.push(area);
						});

						// filter out deleted areas
						const newAreasFiltered = newAreas.filter((area) => !area['deleted_at']);

						// set updated areas locally
						localforage
							.setItem('areas', newAreas)
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								// set updated areas to store
								areas.set(newAreasFiltered);
							})
							.catch(function (err) {
								// set updated areas to store
								areas.set(newAreasFiltered);

								areaError.set(
									'Could not update areas locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						// load areas from cache
						areas.set(areasFiltered);
					}
				} catch (error) {
					// load areas from cache
					areas.set(areasFiltered);

					areaError.set('Could not update areas from API, please try again or contact BTC Map.');
					console.error(error);
				}
			}
		})

		.catch(function (err) {
			areaError.set('Could not load areas locally, please try again or contact BTC Map.');
			console.log(err);
		});
};
