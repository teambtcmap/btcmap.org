import { placesError, places, placesSyncCount, mapUpdates } from '$lib/store';
import { clearTables } from '$lib/sync/clearTables';
import type { Place } from '$lib/types';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';
import { get } from 'svelte/store';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// Helper function to get date 2 weeks ago (fallback)
const getTwoWeeksAgoDate = (): string => {
	const twoWeeksAgo = new Date();
	twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
	return twoWeeksAgo.toISOString();
};

// Helper function to get static file's last modified date
const getStaticFileDate = async (): Promise<string> => {
	try {
		// Use HEAD request to get headers without downloading the full file
		const headResponse = await axios.head('https://cdn.static.btcmap.org/api/v4/places.json');
		const lastModified = headResponse.headers['last-modified'];

		if (lastModified) {
			const staticDate = new Date(lastModified);

			// Validate date is reasonable (not in future, not older than 90 days)
			const now = new Date();
			const ninetyDaysAgo = new Date();
			ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

			if (staticDate <= now && staticDate >= ninetyDaysAgo) {
				console.log(`Using static file date for updates: ${staticDate.toISOString()}`);
				return staticDate.toISOString();
			} else {
				console.warn(`Static file date invalid (${staticDate.toISOString()}), using fallback`);
			}
		}
	} catch (error) {
		console.warn('Failed to get static file date, using fallback:', error);
	}

	// Fallback to 2 weeks ago
	return getTwoWeeksAgoDate();
};

export const elementsSync = async () => {
	// clear old tables if present
	clearTables(['elements', 'elements_v2', 'elements_v3', 'places_v4']);

	// get places from local storage
	await localforage
		.getItem<Place[]>('places_v4')
		.then(async function (cachedPlaces) {
			// add to sync count to only show data refresh after initial load
			const count = get(placesSyncCount);
			placesSyncCount.set(count + 1);

			let placesData: Place[] = [];

			// Step 1: Get base data from static CDN if no cache exists
			if (!cachedPlaces) {
				try {
					const staticResponse = await axios.get<Place[]>(
						'https://cdn.static.btcmap.org/api/v4/places.json'
					);
					placesData = staticResponse.data;
				} catch (error) {
					placesError.set(
						'Could not load places from static CDN, please try again or contact BTC Map.'
					);
					console.error(error);
					return;
				}
			} else {
				// Use cached data as base
				placesData = [...cachedPlaces];
			}

			// Step 2: Get recent updates from API (since static file was last updated)
			const updatesSince = await getStaticFileDate();

			try {
				const apiResponse = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places?fields=id,lat,lon,icon,comments,deleted_at,updated_at&updated_since=${updatesSince}&include_deleted=true`
				);

				const recentUpdates = apiResponse.data;

				if (recentUpdates.length > 0) {
					// Remove existing places that have updates to avoid duplicates
					const updatedPlaceIds = new Set(recentUpdates.map((place) => place.id));
					placesData = placesData.filter((place) => !updatedPlaceIds.has(place.id));

					// Add recent updates (exclude deleted ones for the final dataset)
					recentUpdates.forEach((place) => {
						if (!place.deleted_at) {
							placesData.push(place);
						}
					});

					// Show refresh indicator if we got updates and had cached data
					if (cachedPlaces) {
						mapUpdates.set(true);
					}
				}
			} catch (error) {
				// If API fails but we have cached data, continue with cached data
				if (!cachedPlaces) {
					placesError.set(
						'Could not load recent updates from API, please try again or contact BTC Map.'
					);
					console.error(error);
					return;
				}

				placesError.set('Could not update places from API, using cached data.');
				console.error(error);
			}

			// Step 3: Save to local storage and update store
			if (placesData.length > 0) {
				localforage
					.setItem('places_v4', placesData)
					.then(function () {
						// set response to store
						places.set(placesData);
					})
					.catch(function (err) {
						places.set(placesData);
						placesError.set('Could not store places locally, please try again or contact BTC Map.');
						console.error(err);
					});
			}
		})
		.catch(async function (err) {
			placesError.set('Could not load places locally, please try again or contact BTC Map.');
			console.error(err);

			// Fallback: try to load from static CDN
			const count = get(placesSyncCount);
			placesSyncCount.set(count + 1);

			try {
				const staticResponse = await axios.get<Place[]>(
					'https://cdn.static.btcmap.org/api/v4/places.json'
				);

				if (staticResponse.data.length > 0) {
					places.set(staticResponse.data);
				}
			} catch (error) {
				placesError.set(
					'Could not load places from static CDN, please try again or contact BTC Map.'
				);
				console.error(error);
			}
		});
};
