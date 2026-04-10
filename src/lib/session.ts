import { writable } from "svelte/store";

// Session represents an anonymous/throwaway BTC Map account created on first
// "save" action. The token is persisted in localStorage and used as a Bearer
// token on authenticated API calls.
//
// NOTE: there is no recovery flow in the MVP. If the user clears localStorage
// they lose access to their saved items. A backup flow (set password, link
// Nostr) will be added later.
//
// SECURITY — localStorage token blast radius:
// Storing the Bearer token in localStorage is acceptable here ONLY because
// the account is a throwaway with no recoverable data or PII. The token
// grants access to its own saved_places/saved_areas and nothing else.
// DO NOT reuse this pattern for real user accounts with durable data,
// payment info, or elevated roles — an XSS would exfiltrate the token.
// For real accounts, migrate to httpOnly cookies or similar.
export type Session = {
	username: string;
	token: string;
	savedPlaces: number[];
	savedAreas: number[];
};

const STORAGE_KEY = "btcmap_session";

function loadFromStorage(): Session | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (
			typeof parsed?.username !== "string" ||
			typeof parsed?.token !== "string" ||
			!Array.isArray(parsed?.savedPlaces)
		) {
			return null;
		}
		// Backfill savedAreas for sessions created before this field existed
		if (!Array.isArray(parsed.savedAreas)) {
			parsed.savedAreas = [];
		}
		return parsed as Session;
	} catch {
		return null;
	}
}

function saveToStorage(session: Session | null) {
	if (typeof window === "undefined") return;
	try {
		if (session) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch (err) {
		console.warn("session: failed to persist to localStorage", err);
	}
}

function createSessionStore() {
	const { subscribe, set, update } = writable<Session | null>(null);

	// Tracks the in-flight signUp() promise. Prevents double-click from
	// creating two server-side accounts when called in rapid succession.
	let signUpInFlight: Promise<Session> | null = null;

	const doSignUp = async (): Promise<Session> => {
		// TODO: replace with POST /v4/users when the REST endpoint lands.
		//
		// This is a local-only mock. The existing RPC endpoints (add_user +
		// create_api_key) would work server-side but the browser can't reach
		// them: api.btcmap.org returns HTTP 502 on OPTIONS preflight to /rpc,
		// failing CORS. Rather than build a server-side proxy for a temporary
		// dependency, we mock the future endpoint here. The shape is identical
		// to what the real POST /v4/users call will return, so swapping it in
		// later is a single-function change.
		//
		// Note: the mock token is fake. Real PUT /v4/places/saved calls will
		// fail with 401 until this is replaced.
		const username = generateUsername();
		const token = `mock-${generatePassword()}`;

		const session: Session = {
			username,
			token,
			savedPlaces: [],
			savedAreas: [],
		};
		saveToStorage(session);
		set(session);
		return session;
	};

	return {
		subscribe,

		// Initialize from localStorage. Call in +layout.svelte onMount.
		init: () => {
			const stored = loadFromStorage();
			if (stored) set(stored);
		},

		// Create a throwaway account via the existing RPC endpoints. Returns
		// the new session on success. Stores everything in localStorage so the
		// user stays "logged in" across reloads.
		//
		// Concurrent calls share the same in-flight promise, so double-clicks
		// on the SaveButton won't create two server-side accounts.
		signUp: (): Promise<Session> => {
			if (signUpInFlight) return signUpInFlight;
			signUpInFlight = doSignUp().finally(() => {
				signUpInFlight = null;
			});
			return signUpInFlight;
		},

		// Replace the savedPlaces array. Call after a successful PUT.
		setSavedPlaces: (ids: number[]) => {
			update((current) => {
				if (!current) {
					console.warn(
						"session.setSavedPlaces called with no active session — call signUp() first",
					);
					return current;
				}
				const next = { ...current, savedPlaces: ids };
				saveToStorage(next);
				return next;
			});
		},

		// Replace the savedAreas array. Call after a successful PUT.
		setSavedAreas: (ids: number[]) => {
			update((current) => {
				if (!current) {
					console.warn(
						"session.setSavedAreas called with no active session — call signUp() first",
					);
					return current;
				}
				const next = { ...current, savedAreas: ids };
				saveToStorage(next);
				return next;
			});
		},

		// Toggle a place in saved_places atomically. Computing the next list
		// inside the update() callback avoids a race when multiple buttons
		// read-modify-write concurrently (e.g. on a future "My Saved" list
		// view). Returns the resulting list so the caller can send it to the
		// server via PUT.
		toggleSavedPlace: (id: number): number[] | null => {
			let result: number[] | null = null;
			update((current) => {
				if (!current) {
					console.warn(
						"session.toggleSavedPlace called with no active session — call signUp() first",
					);
					return current;
				}
				const alreadySaved = current.savedPlaces.includes(id);
				const nextSaved = alreadySaved
					? current.savedPlaces.filter((x) => x !== id)
					: [...current.savedPlaces, id];
				result = nextSaved;
				const next = { ...current, savedPlaces: nextSaved };
				saveToStorage(next);
				return next;
			});
			return result;
		},

		// Toggle an area in saved_areas atomically. Same pattern as toggleSavedPlace.
		toggleSavedArea: (id: number): number[] | null => {
			let result: number[] | null = null;
			update((current) => {
				if (!current) {
					console.warn(
						"session.toggleSavedArea called with no active session — call signUp() first",
					);
					return current;
				}
				const alreadySaved = current.savedAreas.includes(id);
				const nextSaved = alreadySaved
					? current.savedAreas.filter((x) => x !== id)
					: [...current.savedAreas, id];
				result = nextSaved;
				const next = { ...current, savedAreas: nextSaved };
				saveToStorage(next);
				return next;
			});
			return result;
		},

		// Clear the session (logout / forget account). No recovery.
		clear: () => {
			saveToStorage(null);
			set(null);
		},
	};
}

// Generates a URL-safe random username like "btcmap-a7k3n9p2yz".
// Prefixed so admins can identify throwaway accounts if needed.
function generateUsername(): string {
	const suffix = Array.from(crypto.getRandomValues(new Uint8Array(5)))
		.map((b) => b.toString(36).padStart(2, "0"))
		.join("");
	return `btcmap-${suffix}`;
}

// Generates a cryptographically random password. Not shown to the user in
// the MVP — they don't need to remember it.
function generatePassword(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export const session = createSessionStore();
