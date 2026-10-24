<script lang="ts">
import { errorStatus } from "#lib/apiError.js";
import type { Login } from "#lib/auth.js";
import { loginWithNostrEvent } from "#lib/auth.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import { buildAuthTemplate } from "#lib/nostr.js";
import NostrAuthMethods from "$components/auth/NostrAuthMethods.svelte";

// Logging in with a Nostr key: the transport panel is shared with the account
// page's link-a-key section, so all this form adds is what to do with the
// signature — exchange it for a session.

type Props = {
	// Mirrors LoginForm's contract: caller decides what happens after a
	// successful login (navigate, complete a pending save, etc.).
	onSuccess: (login: Login) => void | Promise<void>;
};

let { onSuccess }: Props = $props();

// A failed exchange throws, for the panel to report; once logged in, a
// failing follow-up is the host's, not a login error to retry.
async function exchangeSignedEvent(
	signedEvent: SignedAuthEvent,
): Promise<boolean> {
	const login = await loginWithNostrEvent(signedEvent);
	try {
		await onSuccess(login);
	} catch (err) {
		console.error("Login follow-up failed:", errorStatus(err) ?? "unknown");
	}
	return true;
}
</script>

<NostrAuthMethods
	mode="login"
	template={buildAuthTemplate}
	submit={exchangeSignedEvent}
/>
