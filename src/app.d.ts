import type { GeoLocation } from "$lib/types";

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			geo?: GeoLocation;
		}
		// interface Platform {}
	}

	interface Window {
		requestIdleCallback(
			callback: (deadline: IdleDeadline) => void,
			options?: { timeout: number },
		): number;
		cancelIdleCallback(handle: number): void;
	}

	interface IdleDeadline {
		didTimeout: boolean;
		timeRemaining(): number;
	}
}
