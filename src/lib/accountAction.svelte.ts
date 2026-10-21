import { errorStatus } from "#lib/apiError.js";
import { errToast } from "#lib/utils.js";

// One account-page request in flight (#1541): the shared try/toast/log/
// finally of the username, password and Nostr sections. The body owns its
// success steps and expected refusals; anything it throws becomes a toast
// and a status-only log line (never the error itself, which carries the
// Bearer token and request body).
export const createAccountAction = (label: string) => {
	let pending = $state(false);
	return {
		get pending() {
			return pending;
		},
		run: async (errorMessage: string, body: () => Promise<void>) => {
			// Re-entry guard: a disabled button lands a tick late
			if (pending) return;
			pending = true;
			try {
				await body();
			} catch (err) {
				errToast(errorMessage);
				console.error(`${label} failed:`, errorStatus(err) ?? "unknown");
			} finally {
				pending = false;
			}
		},
	};
};
