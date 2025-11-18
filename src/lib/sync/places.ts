import {
	placesError,
	places,
	placesSyncCount,
	mapUpdates,
	placesLoadingStatus,
	placesLoadingProgress
} from '$lib/store';
import { clearTables } from '$lib/sync/clearTables';
import type { Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import axios, { type AxiosProgressEvent } from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';
import { get } from 'svelte/store';
import { parseJSON, filterPlaces } from '$lib/workers/sync-worker-manager';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// Progress range constants for clear progress mapping
const PROGRESS_RANGES = {
	DOWNLOAD_START: 10,
	DOWNLOAD_END: 50,
	PARSE_START: 50,
	PARSE_END: 80,
	CACHE_LOAD: 60,
	UPDATE_CHECK: 70,
	UPDATE_CHECK_NO_CACHE: 85,
	MERGE_START: 80,
	MERGE_START_NO_CACHE: 90,
	FINALIZE: 95,
	COMPLETE: 100
} as const;

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
				console.info(`Using static file date for updates: ${staticDate.toISOString()}`);
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

	// Initialize progress
	placesLoadingProgress.set(0);
	placesLoadingStatus.set('Initializing...');

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
					placesLoadingStatus.set('Downloading places data...');
					placesLoadingProgress.set(PROGRESS_RANGES.DOWNLOAD_START);

					// Fetch as text to parse in worker
					const staticResponse = await axios.get(
						'https://cdn.static.btcmap.org/api/v4/places.json',
						{
							responseType: 'text',
							onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
								if (progressEvent.total) {
									const downloadPercent = (progressEvent.loaded / progressEvent.total) * 100;
									// Map 0-100% download to DOWNLOAD_START-DOWNLOAD_END range
									const downloadRange =
										PROGRESS_RANGES.DOWNLOAD_END - PROGRESS_RANGES.DOWNLOAD_START;
									const scaledProgress =
										PROGRESS_RANGES.DOWNLOAD_START + (downloadPercent / 100) * downloadRange;
									placesLoadingProgress.set(Math.round(scaledProgress));

									const loadedMB = (progressEvent.loaded / (1024 * 1024)).toFixed(1);
									const totalMB = (progressEvent.total / (1024 * 1024)).toFixed(1);
									placesLoadingStatus.set(`Downloading ${loadedMB} MB / ${totalMB} MB...`);
								}
							}
						}
					);

					placesLoadingStatus.set('Processing places data...');
					placesLoadingProgress.set(PROGRESS_RANGES.PARSE_START);

					// Parse JSON in worker thread to avoid blocking main thread
					placesData = await parseJSON<Place[]>(staticResponse.data, 'places', (progress) => {
						// Map 0-100% parsing to PARSE_START-PARSE_END range
						const parseRange = PROGRESS_RANGES.PARSE_END - PROGRESS_RANGES.PARSE_START;
						const scaledProgress =
							PROGRESS_RANGES.PARSE_START + (progress.percent / 100) * parseRange;
						placesLoadingProgress.set(Math.round(scaledProgress));

						if (progress.itemsParsed) {
							placesLoadingStatus.set(
								`Processing ${progress.itemsParsed.toLocaleString()} places...`
							);
						}
					});

					placesLoadingProgress.set(PROGRESS_RANGES.PARSE_END);
				} catch (error) {
					placesError.set(
						'Could not load places from static CDN, please try again or contact BTC Map.'
					);
					placesLoadingStatus.set('');
					placesLoadingProgress.set(0);
					console.error(error);
					return;
				}
			} else {
				// Use cached data as base
				placesData = [...cachedPlaces];
				placesLoadingStatus.set('Loading from cache...');
				placesLoadingProgress.set(PROGRESS_RANGES.CACHE_LOAD);
			}

			// Step 2: Get recent updates from API (since static file was last updated)
			placesLoadingStatus.set('Checking for updates...');
			placesLoadingProgress.set(
				cachedPlaces ? PROGRESS_RANGES.UPDATE_CHECK : PROGRESS_RANGES.UPDATE_CHECK_NO_CACHE
			);

			const updatesSince = await getStaticFileDate();

			try {
				const apiResponse = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places?fields=${buildFieldsParam(PLACE_FIELD_SETS.MAP_SYNC)}&updated_since=${updatesSince}&include_deleted=true`
				);

				const recentUpdates = apiResponse.data;

				if (recentUpdates.length > 0) {
					placesLoadingStatus.set('Merging updates...');
					placesLoadingProgress.set(
						cachedPlaces ? PROGRESS_RANGES.MERGE_START : PROGRESS_RANGES.MERGE_START_NO_CACHE
					);

					// Use worker to filter and merge updates to avoid blocking main thread
					const updatedPlaceIds = recentUpdates.map((place) => place.id);
					placesData = await filterPlaces(placesData, updatedPlaceIds, recentUpdates);

					// Show refresh indicator if we got updates and had cached data
					if (cachedPlaces) {
						mapUpdates.set(true);
					}
				}
			} catch (error) {
				// If API fails, continue with existing data (either cached or CDN)
				placesError.set('Could not update places from API, using cached data.');
				console.error(error);
			}

			// Step 3: Save to local storage and update store
			placesLoadingStatus.set('Finalizing...');
			placesLoadingProgress.set(PROGRESS_RANGES.FINALIZE);

			if (placesData.length > 0) {
				localforage
					.setItem('places_v4', placesData)
					.then(function () {
						// set response to store
						places.set(placesData);
						placesLoadingStatus.set('Complete!');
						placesLoadingProgress.set(PROGRESS_RANGES.COMPLETE);

						// Keep progress at 100% - don't reset to avoid confusing loading states
						// The map component will handle hiding the indicator when elementsLoaded = true
					})
					.catch(function (err) {
						places.set(placesData);
						placesError.set('Could not store places locally, please try again or contact BTC Map.');
						placesLoadingStatus.set('');
						placesLoadingProgress.set(0);
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
				// Fetch as text to parse in worker
				const staticResponse = await axios.get('https://cdn.static.btcmap.org/api/v4/places.json', {
					responseType: 'text'
				});

				// Parse JSON in worker thread
				const parsedPlaces = await parseJSON<Place[]>(staticResponse.data, 'places');

				if (parsedPlaces.length > 0) {
					places.set(parsedPlaces);
				}
			} catch (error) {
				placesError.set(
					'Could not load places from static CDN, please try again or contact BTC Map.'
				);
				console.error(error);
			}
		});
};

export const updateSinglePlace = async (placeId: string | number): Promise<Place | null> => {
	try {
		// Fetch the updated place from the API
		const response = await axios.get<Place>(
			`https://api.btcmap.org/v4/places/${placeId}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
		);
		const updatedPlace = response.data;

		// Get current places from localforage
		const cachedPlaces = await localforage.getItem<Place[]>('places_v4');

		if (!cachedPlaces) {
			console.warn('No cached places found, cannot update single place');
			return null;
		}

		// Find and update the place in the array
		const placeIndex = cachedPlaces.findIndex((p) => p.id === updatedPlace.id);

		let updatedPlaces: Place[];
		if (placeIndex !== -1) {
			// Update existing place
			updatedPlaces = [...cachedPlaces];
			updatedPlaces[placeIndex] = updatedPlace;
		} else {
			// Place not found in cache, add it
			updatedPlaces = [...cachedPlaces, updatedPlace];
		}

		// Save to localforage
		await localforage.setItem('places_v4', updatedPlaces);

		// Update the store
		places.set(updatedPlaces);

		console.info(`Successfully updated place ${placeId} in localforage and store`);
		return updatedPlace;
	} catch (error) {
		console.error(`Failed to update single place ${placeId}:`, error);
		return null;
	}
};
