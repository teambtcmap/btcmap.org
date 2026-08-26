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
		// Shallow-routing state. The add-location wizard stores its current step
		// here so browser back/forward navigates between steps.
		interface PageState {
			wizardStep?: "intro" | "online" | "map" | "update" | "new" | "success";
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
