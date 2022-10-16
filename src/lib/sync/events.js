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
						// set response to local
						localforage
							.setItem('events', response.data)
							.then(function (value) {
								// set response to store
								events.set(response.data);
							})
							.catch(function (err) {
								events.set(response.data);
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
				// load events locally first
				events.set(value);

				// start update sync from API
				try {
					const response = await axios.get(
						`https://api.btcmap.org/v2/events?updated_since=${value[0]['updated_at']}`
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

						// set updated events locally
						localforage
							.setItem('events', newEvents)
							.then(function (value) {
								// set updated events to store
								events.set(newEvents);
							})
							.catch(function (err) {
								eventError.set(
									'Could not update events locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					}
				} catch (error) {
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
