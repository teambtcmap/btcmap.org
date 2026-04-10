import { writable } from "svelte/store";

import api from "$lib/axios";

// Session represents an anonymous/throwaway BTC Map account created on first
// "save" action. The token is persisted in localStorage and used as a Bearer
// token on authenticated API calls.
//
// NOTE: there is no recovery flow in the MVP. If the user clears localStorage
// they lose access to their saved items. A backup flow (set password, link
// Nostr) will be added later.
export type Session = {
	username: string;
	token: string;
	savedPlaces: number[];
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
	} catch {
		// Storage unavailable or quota exceeded
	}
}

function createSessionStore() {
	const { subscribe, set, update } = writable<Session | null>(null);

	// Tracks the in-flight signUp() promise. Prevents double-click from
	// creating two server-side accounts when called in rapid succession.
	let signUpInFlight: Promise<Session> | null = null;

	const doSignUp = async (): Promise<Session> => {
		const username = generateUsername();
		const password = generatePassword();

		const addUserRes = await api.post("https://api.btcmap.org/rpc", {
			jsonrpc: "2.0",
			method: "add_user",
			params: { name: username, password },
			id: 1,
		});

		if (addUserRes.data?.error) {
			throw new Error(
				`add_user failed: ${addUserRes.data.error.message ?? "unknown"}`,
			);
		}

		const keyRes = await api.post("https://api.btcmap.org/rpc", {
			jsonrpc: "2.0",
			method: "create_api_key",
			params: { username, password, label: "btcmap.org" },
			id: 1,
		});

		if (keyRes.data?.error) {
			throw new Error(
				`create_api_key failed: ${keyRes.data.error.message ?? "unknown"}`,
			);
		}

		const token = keyRes.data?.result?.token;
		if (typeof token !== "string") {
			throw new Error("create_api_key did not return a token");
		}

		const session: Session = { username, token, savedPlaces: [] };
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
				if (!current) return current;
				const next = { ...current, savedPlaces: ids };
				saveToStorage(next);
				return next;
			});
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
