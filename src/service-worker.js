/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself
	...files // everything in `static`
];

self.addEventListener('install', (event) => {
	// Create a new cache and add offline file to it
	async function addFileToCache() {
		const cache = await caches.open(CACHE);
		await cache.add('/offline.html');
	}

	event.waitUntil(addFileToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('message', (event) => {
	async function cacheAssets() {
		// Create a new cache and add all files to it
		const cache = await caches.open(CACHE);
		const cached = await cache.match('/cached.txt');

		if (cached) return;

		await cache.addAll(ASSETS);
	}

	if (event.data === 'CACHE_ASSETS') {
		event.waitUntil(cacheAssets());
	}
});

self.addEventListener('fetch', (event) => {
	// ignore POST requests etc
	if (event.request.method !== 'GET') return;

	// ignore requests from chrome-extension etc
	if (event.request.url.indexOf('http') === -1) return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			return cache.match(url.pathname);
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const cachedPage = await cache.match(event.request);

			if (cachedPage && cachedPage.status === 200) {
				return cachedPage;
			} else {
				return cache.match('/offline.html');
			}
		}
	}

	event.respondWith(respond());
});
