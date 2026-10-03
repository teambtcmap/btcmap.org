<script lang="ts">
import AuthPrompt from "$components/auth/AuthPrompt.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { hydrateSavedFromServer } from "$lib/savedItems";
import type { Session } from "$lib/session";

// Sign-in for adding a place photo, in place (shared AuthPrompt): leaving
// for /login dropped the user on /user/activity, away from the place.
type Props = {
	open?: boolean;
	onAuthenticated: () => void;
};

let { open = $bindable(false), onAuthenticated }: Props = $props();

const finish = () => {
	open = false;
	onAuthenticated();
};

async function handleLoginSuccess(current: Session) {
	// Best-effort: keeps saved places in sync like the other login entry points
	try {
		await hydrateSavedFromServer(current.token);
	} catch (err) {
		console.error("PhotoAuthPrompt: hydrate failed", err);
	}
	finish();
}
</script>

<AuthPrompt
	bind:open
	titleId="photo-auth-prompt-title"
	title={$_("placePhotos.promptTitle")}
	description={$_("placePhotos.promptDescription")}
	onCreateAccountClick={() =>
		trackEvent("place_photo_prompt_create_account_click")}
	onLoginClick={() => trackEvent("place_photo_prompt_login_click")}
	onLoginSuccess={handleLoginSuccess}
	onSignupSuccess={finish}
/>
