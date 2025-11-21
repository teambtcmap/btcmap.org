import { areaError, areas } from '$lib/store';
import { clearTables } from '$lib/sync/clearTables';
import type { Area } from '$lib/types';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const limit = 500;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

import { serverCache } from '$lib/cache';

export const areasSync = async () => {
	// Skip local storage operations if running server-side
	const isServerSide = typeof window === 'undefined';

	// Check server cache first if running server-side
	if (isServerSide) {
		const cachedAreas = serverCache.getAreas();
		const lastSync = serverCache.getLastSync();

		if (cachedAreas.length && lastSync) {
			if (Date.now() - lastSync.getTime() < CACHE_DURATION) {
				areas.set(cachedAreas);
				return;
			}

			// Do incremental update if cache exists but expired
			let updatedSince = lastSync.toISOString();
			let responseCount;
			let areasData = cachedAreas;

			do {
				try {
					const response = await axios.get<Area[]>(
						`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
					);

					const newAreas = response.data;
					if (newAreas.length) {
						updatedSince = newAreas[newAreas.length - 1]['updated_at'];
						responseCount = newAreas.length;

						const newAreaIds = new Set(newAreas.map((area) => area.id));
						areasData = areasData.filter((value) => !newAreaIds.has(value.id));
						newAreas.forEach((area) => {
							if (!area.deleted_at && area.tags.type !== 'trash') {
								areasData.push(area);
							}
						});
					} else {
						break;
					}
				} catch (error) {
					console.error('Could not update areas from API:', error);
					break;
				}
			} while (responseCount === limit);

			areas.set(areasData);
			serverCache.setAreas(areasData);
			return;
		}
	}

	if (!isServerSide) {
		// clear tables if present
		clearTables(['areas', 'areas_v2', 'areas_v3']);
	}

	try {
		// Try to get areas from local storage if client-side
		let cachedAreas: Area[] | null = null;
		if (!isServerSide) {
			cachedAreas = await localforage.getItem('areas_v4');
		}

		if (!cachedAreas) {
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
					const responseIds = new Set(response.data.map((data) => data.id));
					const areasUpdated = areasData.filter((area) => !responseIds.has(area.id));
					areasData = areasUpdated;
					response.data.forEach((data) => areasData.push(data));
				} catch (error) {
					areaError.set('Could not load areas from API, please try again or contact BTC Map.');
					console.error(error);
					break;
				}
			} while (responseCount === limit);

			if (areasData.length) {
				const areasFiltered = areasData.filter(
					(area) => !area['deleted_at'] && area.tags?.type !== 'trash'
				);

				// Only try to save to localforage if client-side
				if (!isServerSide) {
					try {
						await localforage.setItem('areas_v4', areasFiltered);
					} catch (err) {
						console.error('Could not store areas locally:', err);
					}
				}

				areas.set(areasFiltered);
				if (isServerSide) {
					serverCache.setAreas(areasFiltered);
				}
			}
		} else {
			// Handle cached data updates
			const cacheSorted = [...cachedAreas];
			cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

			let updatedSince = cacheSorted[0]['updated_at'];
			let responseCount;
			let areasData = cachedAreas;

			do {
				try {
					const response = await axios.get<Area[]>(
						`https://api.btcmap.org/v2/areas?updated_since=${updatedSince}&limit=${limit}`
					);

					const newAreas = response.data;
					if (newAreas.length) {
						updatedSince = newAreas[newAreas.length - 1]['updated_at'];
						responseCount = newAreas.length;

						const newAreaIds = new Set(newAreas.map((area) => area.id));
						const areasUpdated = areasData.filter((value) => !newAreaIds.has(value.id));
						areasData = areasUpdated;

						newAreas.forEach((area) => {
							if (!area['deleted_at']) {
								areasData.push(area);
							}
						});
					} else {
						break;
					}
				} catch (error) {
					console.error('Could not update areas from API:', error);
					break;
				}
			} while (responseCount === limit);

			if (!isServerSide) {
				try {
					await localforage.setItem('areas_v4', areasData);
				} catch (err) {
					console.error('Could not update areas locally:', err);
				}
			}

			areas.set(areasData);
		}
	} catch (err) {
		console.error('Areas sync failed:', err);
		areaError.set('Could not sync areas, please try again or contact BTC Map.');
	}
};
