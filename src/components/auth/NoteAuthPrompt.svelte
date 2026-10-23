<script lang="ts">
import { trackEvent } from "#lib/analytics.js";
import { _ } from "#lib/i18n/index.js";
import { hydrateSavedFromServer } from "#lib/savedItems.js";
import type { Session } from "#lib/session.js";
import AuthPrompt from "$components/auth/AuthPrompt.svelte";

// Sign-in for adding a note, in place (shared AuthPrompt): the add card
// waits at its point on the map and opens once the user is signed in.
type Props = {
	open?: boolean;
	// The add card opens on its own once a session exists, so most
	// callers need nothing here.
	onAuthenticated?: () => void;
};

let { open = $bindable(false), onAuthenticated }: Props = $props();

const finish = () => {
	open = false;
	onAuthenticated?.();
};

async function handleLoginSuccess(current: Session) {
	// Best-effort: keeps saved places in sync like the other login entry points
	try {
		await hydrateSavedFromServer(current.token);
	} catch (err) {
		console.error("NoteAuthPrompt: hydrate failed", err);
	}
	finish();
}
</script>

<AuthPrompt
	bind:open
	titleId="note-auth-prompt-title"
	title={$_("notes.promptTitle")}
	description={$_("notes.promptDescription")}
	onCreateAccountClick={() => trackEvent("note_prompt_create_account_click")}
	onLoginClick={() => trackEvent("note_prompt_login_click")}
	onLoginSuccess={handleLoginSuccess}
	onSignupSuccess={finish}
/>
