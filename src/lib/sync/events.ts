import { eventError, events } from '$lib/store';
import { clearTables } from '$lib/sync/clearTables';
import type { Event } from '$lib/types';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const limit = 50000;

export const eventsSync = async () => {
	// clear tables if present
	clearTables(['events', 'events_v2', 'events_v3']);

	// get events from local
	await localforage
		.getItem<Event[]>('events_v4')
		.then(async function (value) {
			// get events from API if initial sync
			if (!value) {
				let updatedSince = '2022-01-01T00:00:00.000Z';
				let responseCount;
				let eventsData: Event[] = [];

				do {
					try {
						const response = await axios.get<Event[]>(
							`https://api.btcmap.org/v2/events?updated_since=${updatedSince}&limit=${limit}`
						);

						updatedSince = response.data[response.data.length - 1]['updated_at'];
						responseCount = response.data.length;
						const responseIds = new Set(response.data.map((data) => data.id));
						const eventsUpdated = eventsData.filter((event) => !responseIds.has(event.id));
						eventsData = eventsUpdated;
						response.data.forEach((data) => eventsData.push(data));
					} catch (error) {
						eventError.set('Could not load events from API, please try again or contact BTC Map.');
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (eventsData.length) {
					// filter out deleted events
					const eventsFiltered = eventsData.filter((event) => !event['deleted_at']);

					// set response to local
					localforage
						.setItem('events_v4', eventsFiltered)
						.then(function () {
							// set response to store
							events.set(eventsFiltered);
						})
						.catch(function (err) {
							events.set(eventsFiltered);
							eventError.set(
								'Could not store events locally, please try again or contact BTC Map.'
							);
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
				let eventsData = value;
				let useCachedData = false;

				do {
					try {
						const response = await axios.get<Event[]>(
							`https://api.btcmap.org/v2/events?updated_since=${updatedSince}&limit=${limit}`
						);

						// update new records if they exist
						const newEvents = response.data;

						// check for new events in local and purge if they exist
						if (newEvents.length) {
							updatedSince = newEvents[newEvents.length - 1]['updated_at'];
							responseCount = newEvents.length;

							const newEventIds = new Set(newEvents.map((event) => event.id));
							const eventsUpdated = eventsData.filter((value) => !newEventIds.has(value.id));
							eventsData = eventsUpdated;

							// add new events
							newEvents.forEach((event) => {
								if (!event['deleted_at']) {
									eventsData.push(event);
								}
							});
						} else {
							// load events from cache
							events.set(value);
							useCachedData = true;
							break;
						}
					} catch (error) {
						// load events from cache
						events.set(value);
						useCachedData = true;

						eventError.set(
							'Could not update events from API, please try again or contact BTC Map.'
						);
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (!useCachedData) {
					// set updated events locally
					localforage
						.setItem('events_v4', eventsData)
						.then(function () {
							// set updated events to store
							events.set(eventsData);
						})
						.catch(function (err) {
							// set updated events to store
							events.set(eventsData);

							eventError.set(
								'Could not update events locally, please try again or contact BTC Map.'
							);
							console.error(err);
						});
				}
			}
		})

		.catch(async function (err) {
			eventError.set('Could not load events locally, please try again or contact BTC Map.');
			console.error(err);

			let updatedSince = '2022-01-01T00:00:00.000Z';
			let responseCount;
			let eventsData: Event[] = [];

			do {
				try {
					const response = await axios.get<Event[]>(
						`https://api.btcmap.org/v2/events?updated_since=${updatedSince}&limit=${limit}`
					);

					updatedSince = response.data[response.data.length - 1]['updated_at'];
					responseCount = response.data.length;
					const responseIds = new Set(response.data.map((data) => data.id));
					const eventsUpdated = eventsData.filter((event) => !responseIds.has(event.id));
					eventsData = eventsUpdated;
					response.data.forEach((data) => eventsData.push(data));
				} catch (error) {
					eventError.set('Could not load events from API, please try again or contact BTC Map.');
					console.error(error);
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
