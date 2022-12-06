import localforage from 'localforage';
import axios from 'axios';
import { events, eventError } from '$lib/store';

export const eventsSync = async () => {
	// get events from local
	await localforage
		.getItem('events')
		.then(async function (value) {
			// get events from API if initial sync
			if (!value) {
				try {
					const response = await axios.get('https://api.btcmap.org/v2/events');

					if (response.data.length) {
						// filter out deleted events
						const eventsFiltered = response.data.filter((event) => !event['deleted_at']);

						// set response to local
						localforage
							.setItem('events', response.data)
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
					} else {
						eventError.set(
							'Events API returned an empty result, please try again or contact BTC Map.'
						);
					}
				} catch (error) {
					eventError.set('Could not load events from API, please try again or contact BTC Map.');
					console.log(error);
				}
			} else {
				// filter out deleted events
				const eventsFiltered = value.filter((event) => !event['deleted_at']);

				// start update sync from API
				try {
					// sort to get most recent record
					let cacheSorted = [...value];
					cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

					const response = await axios.get(
						`https://api.btcmap.org/v2/events?updated_since=${cacheSorted[0]['updated_at']}`
					);

					// update new records if they exist
					let newEvents = response.data;

					// check for new events in local and purge if they exist
					if (newEvents.length) {
						let updatedEvents = value.filter((value) => {
							if (newEvents.find((event) => event.id === value.id)) {
								return false;
							} else {
								return true;
							}
						});

						// add new events
						updatedEvents.forEach((event) => {
							newEvents.push(event);
						});

						// filter out deleted events
						const newEventsFiltered = newEvents.filter((event) => !event['deleted_at']);

						// set updated events locally
						localforage
							.setItem('events', newEvents)
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
					} else {
						// load events from cache
						events.set(eventsFiltered);
					}
				} catch (error) {
					// load events from cache
					events.set(eventsFiltered);

					eventError.set('Could not update events from API, please try again or contact BTC Map.');
					console.error(error);
				}
			}
		})

		.catch(function (err) {
			eventError.set('Could not load events locally, please try again or contact BTC Map.');
			console.log(err);
		});
};
