import { isValid } from "date-fns/isValid";
import { parseISO } from "date-fns/parseISO";
import type { Readable } from "svelte/store";
import { derived, writable } from "svelte/store";

import type { ActivityItem } from "$lib/activity";
import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";
import type { Session } from "$lib/session";

export const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
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

// hasNewActivity compares dates as raw strings (lexicographic ==
// chronological for ISO-8601), so junk values like "abc" silently
// force the comparison into "always false" and the user never sees
// the dot. parseISO + isValid rejects unparseable and impossible
// dates so we can treat them as missing.
export function isValidLastSeen(raw: string | null): raw is string {
	return raw !== null && isValid(parseISO(raw));
}

export function loadLastSeen(username: string): void {
	if (typeof window === "undefined") return;
	const raw = localStorage.getItem(storageKeyFor(username));
	lastSeenActivityDate.set(isValidLastSeen(raw) ? raw : null);
}

export function markActivitySeen(username: string, date: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(storageKeyFor(username), date);
	lastSeenActivityDate.set(date);
}

// Mirrors the server-side cap in /v4/activity.
export const MAX_PLACES = 500;

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
	// Bumped every time the session identity changes (login / logout /
	// account switch / same-user re-login). fetchNow captures the value
	// at call time and discards its response — and refuses to release
	// the inFlight slot — when the generation has moved on, so a stale
	// network request can't overwrite the active session's state and
	// can't block a fresh tick from starting its own fetch.
	let fetchGeneration = 0;

	const isVisible = (): boolean =>
		typeof document === "undefined" || document.visibilityState === "visible";

	const fetchNow = async (s: Session): Promise<void> => {
		if (inFlight) return inFlight;
		const gen = fetchGeneration;
		inFlight = (async () => {
			try {
				const res = await api.get<ActivityItem[]>(buildPollUrl(s));
				if (gen !== fetchGeneration) return;
				const newest = res.data[0]?.date ?? null;
				lastFetchAt = Date.now();
				if (newest) {
					latestActivityDate.set(newest);
					// Bootstrap lastSeen on the first poll so a logged-in user
					// doesn't see a red dot from activity that happened before
					// they ever opened the page. Also bootstrap when the
					// stored value is malformed — leaving junk there would
					// keep hasNewActivity stuck against a value the user
					// could never "match".
					const stored = localStorage.getItem(storageKeyFor(s.username));
					if (!isValidLastSeen(stored)) {
						markActivitySeen(s.username, newest);
					}
				}
			} catch {
				// Silent failure — try again next interval.
			} finally {
				// Only release the slot if we are still the active generation;
				// otherwise the subscribe handler has already nulled inFlight
				// and possibly assigned a fresh fetch we must not stomp on.
				if (gen === fetchGeneration) inFlight = null;
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

	const stopInterval = (): void => {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	};

	const unsubSession = sessionStore.subscribe((s) => {
		currentSession = s;
		const newUsername = s?.username ?? null;
		const identityChanged = newUsername !== currentUsername;

		if (identityChanged) {
			fetchGeneration += 1;
			// Drop the in-flight slot so the next tick can spawn a fresh
			// fetch immediately. The previous in-flight (if any) will
			// discard its own response via the gen check.
			inFlight = null;
			currentUsername = newUsername;
		}

		if (!s) {
			latestActivityDate.set(null);
			lastSeenActivityDate.set(null);
			stopInterval();
			return;
		}

		// Per-username bootstrap (load lastSeen, reset latest) — only on
		// the transition into this username.
		if (identityChanged) {
			loadLastSeen(s.username);
			latestActivityDate.set(null);
			lastFetchAt = 0;
		}

		// Reconcile the polling interval on every session update so a user
		// who saves their first place mid-session starts being polled, and
		// a user who unsaves their last item stops.
		if (hasSavedItems(s)) {
			if (intervalId === null) {
				intervalId = setInterval(tick, POLL_INTERVAL_MS);
			}
			if (identityChanged || lastFetchAt === 0) tick();
		} else {
			stopInterval();
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
		stopInterval();
		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", onVisibility);
		}
	};
}
