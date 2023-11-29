import { areaError, areas } from '$lib/store';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';

axiosRetry(axios, { retries: 3 });

const limit = 500;

export const areasSync = async () => {
	// clear v1 table if present
	await localforage
		.getItem('areas')
		.then(function (value) {
			if (value) {
				localforage
					.removeItem('areas')
					.then(function () {
						console.log('Key is cleared!');
					})
					.catch(function (err) {
						areaError.set('Could not clear areas locally, please try again or contact BTC Map.');
						console.log(err);
					});
			}
		})
		.catch(function (err) {
			areaError.set('Could not check areas locally, please try again or contact BTC Map.');
			console.log(err);
		});

	// get areas from local
	await localforage
		.getItem('areas_v2')
		.then(async function (value) {
			// get areas from API if initial sync
			if (!value) {
				let updatedSince = '2022-01-01T00:00:00.000Z';
				let responseCount;
				let areasData = [];

				do {
					try {
						const response = await axios.get(
							`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
						);

						if (response.data.length) {
							updatedSince = response.data[response.data.length - 1]['updated_at'];
							responseCount = response.data.length;
							areasData.filter((area) => !response.data.find((data) => data.id === area.id));
							response.data.forEach((data) => areasData.push(data));
						} else {
							areaError.set(
								'Areas API returned an empty result, please try again or contact BTC Map.'
							);
							break;
						}
					} catch (error) {
						areaError.set('Could not load areas from API, please try again or contact BTC Map.');
						console.log(error);
						break;
					}
				} while (responseCount === limit);

				if (areasData.length) {
					// filter out deleted areas
					const areasFiltered = areasData.filter((area) => !area['deleted_at']);

					// set response to local
					localforage
						.setItem('areas_v2', areasData)
						// eslint-disable-next-line no-unused-vars
						.then(function (value) {
							// set response to store
							areas.set(areasFiltered);
						})
						.catch(function (err) {
							areas.set(areasFiltered);
							areaError.set('Could not store areas locally, please try again or contact BTC Map.');
							console.log(err);
						});
				}
			} else {
				// filter out deleted areas
				const areasFiltered = value.filter((area) => !area['deleted_at']);

				// start update sync from API
				// sort to get most recent record
				let cacheSorted = [...value];
				cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

				let updatedSince = cacheSorted[0]['updated_at'];
				let responseCount;
				let areasData = value;
				let useCachedData = false;

				do {
					try {
						const response = await axios.get(
							`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
						);

						// update new records if they exist
						let newAreas = response.data;

						// check for new areas in local and purge if they exist
						if (newAreas.length) {
							updatedSince = newAreas[newAreas.length - 1]['updated_at'];
							responseCount = newAreas.length;

							areasData.filter((value) => {
								if (newAreas.find((area) => area.id === value.id)) {
									return false;
								} else {
									return true;
								}
							});

							// add new areas
							newAreas.forEach((area) => {
								areasData.push(area);
							});
						} else {
							// load areas from cache
							areas.set(areasFiltered);
							useCachedData = true;
							break;
						}
					} catch (error) {
						// load areas from cache
						areas.set(areasFiltered);
						useCachedData = true;

						areaError.set('Could not update areas from API, please try again or contact BTC Map.');
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (!useCachedData) {
					// filter out deleted areas
					const newAreasFiltered = areasData.filter((area) => !area['deleted_at']);

					// set updated areas locally
					localforage
						.setItem('areas_v2', areasData)
						// eslint-disable-next-line no-unused-vars
						.then(function (value) {
							// set updated areas to store
							areas.set(newAreasFiltered);
						})
						.catch(function (err) {
							// set updated areas to store
							areas.set(newAreasFiltered);

							areaError.set('Could not update areas locally, please try again or contact BTC Map.');
							console.log(err);
						});
				}
			}
		})

		.catch(async function (err) {
			areaError.set('Could not load areas locally, please try again or contact BTC Map.');
			console.log(err);

			let updatedSince = '2022-01-01T00:00:00.000Z';
			let responseCount;
			let areasData = [];

			do {
				try {
					const response = await axios.get(
						`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
					);

					if (response.data.length) {
						updatedSince = response.data[response.data.length - 1]['updated_at'];
						responseCount = response.data.length;
						areasData.filter((area) => !response.data.find((data) => data.id === area.id));
						response.data.forEach((data) => areasData.push(data));
					} else {
						areaError.set(
							'Areas API returned an empty result, please try again or contact BTC Map.'
						);
						break;
					}
				} catch (error) {
					areaError.set('Could not load areas from API, please try again or contact BTC Map.');
					console.log(error);
					break;
				}
			} while (responseCount === limit);

			if (areasData.length) {
				// filter out deleted areas
				const areasFiltered = areasData.filter((area) => !area['deleted_at']);

				// set response to store
				areas.set(areasFiltered);
			}
		});
};
