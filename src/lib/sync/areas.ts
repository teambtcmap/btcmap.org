import { areaError, areas } from '$lib/store';
import { clearTables } from '$lib/sync/clearTables';
import type { Area } from '$lib/types';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const limit = 500;

export const areasSync = async () => {
	// clear tables if present
	clearTables(['areas', 'areas_v2', 'areas_v3']);

	// get areas from local
	await localforage
		.getItem<Area[]>('areas_v4')
		.then(async function (value) {
			// get areas from API if initial sync
			if (!value) {
				let updatedSince = '2022-01-01T00:00:00.000Z';
				let responseCount;
				let areasData: Area[] = [];

				do {
					try {
						const response = await axios.get<Area[]>(
							`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
						);

						updatedSince = response.data[response.data.length - 1]['updated_at'];
						responseCount = response.data.length;
						const areasUpdated = areasData.filter(
							(area) => !response.data.find((data) => data.id === area.id)
						);
						areasData = areasUpdated;
						response.data.forEach((data) => areasData.push(data));
					} catch (error) {
						areaError.set('Could not load areas from API, please try again or contact BTC Map.');
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (areasData.length) {
					// filter out deleted areas
					const areasFiltered = areasData.filter((area) => !area['deleted_at']);

					// set response to local
					localforage
						.setItem('areas_v4', areasFiltered)
						.then(function () {
							// set response to store
							areas.set(areasFiltered);
						})
						.catch(function (err) {
							areas.set(areasFiltered);
							areaError.set('Could not store areas locally, please try again or contact BTC Map.');
							console.error(err);
						});
				}
			} else {
				// start update sync from API
				// sort to get most recent record
				const cacheSorted = [...value];
				cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

				let updatedSince = cacheSorted[0]['updated_at'];
				let responseCount;
				let areasData = value;
				let useCachedData = false;

				do {
					try {
						const response = await axios.get<Area[]>(
							`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
						);

						// update new records if they exist
						const newAreas = response.data;

						// check for new areas in local and purge if they exist
						if (newAreas.length) {
							updatedSince = newAreas[newAreas.length - 1]['updated_at'];
							responseCount = newAreas.length;

							const areasUpdated = areasData.filter((value) => {
								if (newAreas.find((area) => area.id === value.id)) {
									return false;
								} else {
									return true;
								}
							});
							areasData = areasUpdated;

							// add new areas
							newAreas.forEach((area) => {
								if (!area['deleted_at']) {
									areasData.push(area);
								}
							});
						} else {
							// load areas from cache
							areas.set(value);
							useCachedData = true;
							break;
						}
					} catch (error) {
						// load areas from cache
						areas.set(value);
						useCachedData = true;

						areaError.set('Could not update areas from API, please try again or contact BTC Map.');
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (!useCachedData) {
					// set updated areas locally
					localforage
						.setItem('areas_v4', areasData)
						.then(function () {
							// set updated areas to store
							areas.set(areasData);
						})
						.catch(function (err) {
							// set updated areas to store
							areas.set(areasData);

							areaError.set('Could not update areas locally, please try again or contact BTC Map.');
							console.error(err);
						});
				}
			}
		})

		.catch(async function (err) {
			areaError.set('Could not load areas locally, please try again or contact BTC Map.');
			console.error(err);

			let updatedSince = '2022-01-01T00:00:00.000Z';
			let responseCount;
			let areasData: Area[] = [];

			do {
				try {
					const response = await axios.get<Area[]>(
						`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
					);

					updatedSince = response.data[response.data.length - 1]['updated_at'];
					responseCount = response.data.length;
					const areasUpdated = areasData.filter(
						(area) => !response.data.find((data) => data.id === area.id)
					);
					areasData = areasUpdated;
					response.data.forEach((data) => areasData.push(data));
				} catch (error) {
					areaError.set('Could not load areas from API, please try again or contact BTC Map.');
					console.error(error);
					break;
				}
			} while (responseCount === limit);

			if (areasData.length) {
				// filter out deleted areas and areas of type trash
				const areasFiltered = areasData.filter((area) => !area['deleted_at'] && area['tags.type'] !== 'trash');

				// set response to store
				areas.set(areasFiltered);
			}
		});
};
