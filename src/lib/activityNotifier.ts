import type { Readable } from "svelte/store";
import { derived, writable } from "svelte/store";

import type { ActivityItem } from "$lib/activity";
import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";
import type { Session } from "$lib/session";

export const POLL_INTERVAL_MS = 30 * 60 * 1000;
export const POLL_DAYS = 1;
export const STORAGE_KEY_PREFIX = "btcmap_activity_lastseen:";

export const storageKeyFor = (username: string): string =>
	`${STORAGE_KEY_PREFIX}${username}`;

export const latestActivityDate = writable<string | null>(null);
export const lastSeenActivityDate = writable<string | null>(null);

export const hasNewActivity = derived(
	[latestActivityDate, lastSeenActivityDate],
	([$latest, $seen]) => {
		if (!$latest) return false;
		if (!$seen) return true;
		return $latest > $seen;
	},
);

export function loadLastSeen(username: string): void {
	if (typeof window === "undefined") return;
	const raw = localStorage.getItem(storageKeyFor(username));
	lastSeenActivityDate.set(raw ?? null);
}

export function markActivitySeen(username: string, date: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(storageKeyFor(username), date);
	lastSeenActivityDate.set(date);
}

// Mirrors the server-side cap in /v4/activity.
const MAX_PLACES = 500;

function buildPollUrl(s: Session): string {
	const params = new URLSearchParams({ days: String(POLL_DAYS) });
	const places = s.savedPlaces.slice(0, MAX_PLACES);
	if (s.savedAreas.length) params.set("areas", s.savedAreas.join(","));
	if (places.length) params.set("places", places.join(","));
	return `${API_BASE}/v4/activity?${params}`;
}

function hasSavedItems(s: Session): boolean {
	return s.savedPlaces.length > 0 || s.savedAreas.length > 0;
}

export function startActivityPolling(
	sessionStore: Readable<Session | null>,
): () => void {
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let lastFetchAt = 0;
	let currentUsername: string | null = null;
	let currentSession: Session | null = null;
	let inFlight: Promise<void> | null = null;

	const isVisible = (): boolean =>
		typeof document === "undefined" || document.visibilityState === "visible";

	const fetchNow = async (s: Session): Promise<void> => {
		if (inFlight) return inFlight;
		inFlight = (async () => {
			try {
				const res = await api.get<ActivityItem[]>(buildPollUrl(s));
				const newest = res.data[0]?.date ?? null;
				lastFetchAt = Date.now();
				if (newest) {
					latestActivityDate.set(newest);
					// Bootstrap lastSeen on the first poll so a logged-in user
					// doesn't see a red dot from activity that happened before
					// they ever opened the page.
					if (localStorage.getItem(storageKeyFor(s.username)) === null) {
						markActivitySeen(s.username, newest);
					}
				}
			} catch {
				// Silent failure — try again next interval.
			} finally {
				inFlight = null;
			}
		})();
		return inFlight;
	};

	const tick = (): void => {
		if (!isVisible()) return;
		const s = currentSession;
		if (!s || !hasSavedItems(s)) return;
		void fetchNow(s);
	};

	const unsubSession = sessionStore.subscribe((s) => {
		currentSession = s;
		if (s) {
			if (s.username !== currentUsername) {
				currentUsername = s.username;
				loadLastSeen(s.username);
				latestActivityDate.set(null);
				lastFetchAt = 0;
				if (hasSavedItems(s)) {
					if (intervalId === null) {
						intervalId = setInterval(tick, POLL_INTERVAL_MS);
					}
					tick();
				}
			}
		} else {
			currentUsername = null;
			latestActivityDate.set(null);
			lastSeenActivityDate.set(null);
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		}
	});

	const onVisibility = (): void => {
		if (!isVisible()) return;
		if (Date.now() - lastFetchAt >= POLL_INTERVAL_MS) tick();
	};
	if (typeof document !== "undefined") {
		document.addEventListener("visibilitychange", onVisibility);
	}

	return () => {
		unsubSession();
		if (intervalId !== null) clearInterval(intervalId);
		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", onVisibility);
		}
	};
}
