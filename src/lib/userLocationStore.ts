import { get, writable } from "svelte/store";

import { browser } from "$app/environment";

export interface UserLocation {
	lat: number;
	lon: number;
}

interface UserLocationState {
	location: UserLocation | null;
	lastUpdated: number | null;
	usesMetricSystem: boolean | null;
}

const DEFAULT_CACHE_AGE_MS = 5 * 60 * 1000;

const initialState: UserLocationState = {
	location: null,
	lastUpdated: null,
	usesMetricSystem: null,
};

function isInImperialCountry(lat: number, lon: number): boolean {
	const inContiguousUS = lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66;
	const inAlaska = lat >= 54 && lat <= 71 && lon >= -179 && lon <= -129;
	const inHawaii = lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154;
	return inContiguousUS || inAlaska || inHawaii;
}

function getCurrentPosition(): Promise<{
	latitude: number;
	longitude: number;
}> {
	return new Promise((resolve, reject) => {
		if (!browser || !navigator.geolocation) {
			reject(new Error("Geolocation not available"));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				});
			},
			(error) => {
				reject(error);
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000,
			},
		);
	});
}

function createUserLocationStore() {
	const store = writable<UserLocationState>(initialState);
	const { subscribe } = store;

	async function getLocationWithCache(
		maxAgeMs: number = DEFAULT_CACHE_AGE_MS,
	): Promise<UserLocation | null> {
		if (!browser) return null;

		const currentState = get(store);

		if (currentState?.location && currentState?.lastUpdated) {
			const age = Date.now() - currentState.lastUpdated;
			if (age < maxAgeMs) {
				return currentState.location;
			}
		}

		try {
			const position = await getCurrentPosition();
			const location: UserLocation = {
				lat: position.latitude,
				lon: position.longitude,
			};

			store.set({
				location,
				lastUpdated: Date.now(),
				usesMetricSystem: !isInImperialCountry(location.lat, location.lon),
			});

			return location;
		} catch {
			return currentState?.location ?? null;
		}
	}

	async function getLocation(): Promise<UserLocation | null> {
		if (!browser) return null;

		try {
			const position = await getCurrentPosition();
			const location: UserLocation = {
				lat: position.latitude,
				lon: position.longitude,
			};

			store.set({
				location,
				lastUpdated: Date.now(),
				usesMetricSystem: !isInImperialCountry(location.lat, location.lon),
			});

			return location;
		} catch {
			return null;
		}
	}

	return {
		subscribe,
		getLocationWithCache,
		getLocation,
	};
}

export const userLocation = createUserLocationStore();
