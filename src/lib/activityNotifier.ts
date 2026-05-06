import { derived, writable } from "svelte/store";

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
