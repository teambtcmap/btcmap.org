import { eventError, events } from '$lib/store';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';

axiosRetry(axios, { retries: 3 });

const limit = 50000;

export const eventsSync = async () => {
	// clear v1 table if present
	await localforage
		.getItem('events')
		.then(function (value) {
			if (value) {
				localforage
					.removeItem('events')
					.then(function () {
						console.log('Key is cleared!');
					})
					.catch(function (err) {
						eventError.set('Could not clear events locally, please try again or contact BTC Map.');
						console.log(err);
					});
			}
		})
		.catch(function (err) {
			eventError.set('Could not check events locally, please try again or contact BTC Map.');
			console.log(err);
		});

	// clear v2 table if present
	await localforage
		.getItem('events_v2')
		.then(function (value) {
			if (value) {
				localforage
					.removeItem('events_v2')
					.then(function () {
						console.log('Key is cleared!');
					})
					.catch(function (err) {
						eventError.set('Could not clear events locally, please try again or contact BTC Map.');
						console.log(err);
					});
			}
		})
		.catch(function (err) {
			eventError.set('Could not check events locally, please try again or contact BTC Map.');
			console.log(err);
		});

	// get events from local
	await localforage
		.getItem('events_v3')
		.then(async function (value) {
			// get events from API if initial sync
			if (!value) {
				let updatedSince = '2022-01-01T00:00:00.000Z';
				let responseCount;
				let eventsData = [];

				do {
					try {
						const response = await axios.get(
							`https://api.btcmap.org/v2/events?updated_since=${updatedSince}&limit=${limit}`
						);

						if (response.data.length) {
							updatedSince = response.data[response.data.length - 1]['updated_at'];
							responseCount = response.data.length;
							const eventsUpdated = eventsData.filter(
								(event) => !response.data.find((data) => data.id === event.id)
							);
							eventsData = eventsUpdated;
							response.data.forEach((data) => eventsData.push(data));
						} else {
							eventError.set(
								'Events API returned an empty result, please try again or contact BTC Map.'
							);
							break;
						}
					} catch (error) {
						eventError.set('Could not load events from API, please try again or contact BTC Map.');
						console.log(error);
						break;
					}
				} while (responseCount === limit);

				if (eventsData.length) {
					// filter out deleted events
					const eventsFiltered = eventsData.filter((event) => !event['deleted_at']);

					// set response to local
					localforage
						.setItem('events_v3', eventsData)
						// eslint-disable-next-line no-unused-vars
						.then(function (value) {
							// set response to store
							events.set(eventsFiltered);
						})
						.catch(function (err) {
							events.set(eventsFiltered);
							eventError.set(
								'Could not store events locally, please try again or contact BTC Map.'
							);
							console.log(err);
						});
				}
			} else {
				// filter out deleted events
				const eventsFiltered = value.filter((event) => !event['deleted_at']);

				// start update sync from API
				// sort to get most recent record
				let cacheSorted = [...value];
				cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

				let updatedSince = cacheSorted[0]['updated_at'];
				let responseCount;
				let eventsData = value;
				let useCachedData = false;

				do {
					try {
						const response = await axios.get(
							`https://api.btcmap.org/v2/events?updated_since=${updatedSince}&limit=${limit}`
						);

						// update new records if they exist
						let newEvents = response.data;

						// check for new events in local and purge if they exist
						if (newEvents.length) {
							updatedSince = newEvents[newEvents.length - 1]['updated_at'];
							responseCount = newEvents.length;

							const eventsUpdated = eventsData.filter((value) => {
								if (newEvents.find((event) => event.id === value.id)) {
									return false;
								} else {
									return true;
								}
							});
							eventsData = eventsUpdated;

							// add new events
							newEvents.forEach((event) => {
								eventsData.push(event);
							});
						} else {
							// load events from cache
							events.set(eventsFiltered);
							useCachedData = true;
							break;
						}
					} catch (error) {
						// load events from cache
						events.set(eventsFiltered);
						useCachedData = true;

						eventError.set(
							'Could not update events from API, please try again or contact BTC Map.'
						);
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (!useCachedData) {
					// filter out deleted events
					const newEventsFiltered = eventsData.filter((event) => !event['deleted_at']);

					// set updated events locally
					localforage
						.setItem('events_v3', eventsData)
						// eslint-disable-next-line no-unused-vars
						.then(function (value) {
							// set updated events to store
							events.set(newEventsFiltered);
						})
						.catch(function (err) {
							// set updated events to store
							events.set(newEventsFiltered);

							eventError.set(
								'Could not update events locally, please try again or contact BTC Map.'
							);
							console.log(err);
						});
				}
			}
		})

		.catch(async function (err) {
			eventError.set('Could not load events locally, please try again or contact BTC Map.');
			console.log(err);

			let updatedSince = '2022-01-01T00:00:00.000Z';
			let responseCount;
			let eventsData = [];

			do {
				try {
					const response = await axios.get(
						`https://api.btcmap.org/v2/events?updated_since=${updatedSince}&limit=${limit}`
					);

					if (response.data.length) {
						updatedSince = response.data[response.data.length - 1]['updated_at'];
						responseCount = response.data.length;
						const eventsUpdated = eventsData.filter(
							(event) => !response.data.find((data) => data.id === event.id)
						);
						eventsData = eventsUpdated;
						response.data.forEach((data) => eventsData.push(data));
					} else {
						eventError.set(
							'Events API returned an empty result, please try again or contact BTC Map.'
						);
						break;
					}
				} catch (error) {
					eventError.set('Could not load events from API, please try again or contact BTC Map.');
					console.log(error);
					break;
				}
			} while (responseCount === limit);

			if (eventsData.length) {
				// filter out deleted events
				const eventsFiltered = eventsData.filter((event) => !event['deleted_at']);

				// set response to store
				events.set(eventsFiltered);
			}
		});
};
