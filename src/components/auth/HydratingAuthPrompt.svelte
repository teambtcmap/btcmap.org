<script lang="ts">
import { hydrateSavedFromServer } from "#lib/savedItems.js";
import type { Session } from "#lib/session.js";
import AuthPrompt from "$components/auth/AuthPrompt.svelte";

// The shared AuthPrompt for flows that resume in place once the user is
// signed in (adding a place photo, adding a note): a login also pulls the
// saved places from the server, like the other login entry points.
type Props = {
	open?: boolean;
	titleId: string;
	title: string;
	description: string;
	onCreateAccountClick: () => void;
	onLoginClick: () => void;
	// Not needed when the caller already reacts to the session appearing
	onAuthenticated?: () => void;
};

let {
	open = $bindable(false),
	titleId,
	title,
	description,
	onCreateAccountClick,
	onLoginClick,
	onAuthenticated,
}: Props = $props();

const finish = () => {
	open = false;
	onAuthenticated?.();
};

async function handleLoginSuccess(current: Session) {
	// Best-effort: a failed hydrate must not block the flow that resumes
	try {
		await hydrateSavedFromServer(current.token);
	} catch (err) {
		console.error(`${titleId}: hydrate failed`, err);
	}
	finish();
}
</script>

<AuthPrompt
	bind:open
	{titleId}
	{title}
	{description}
	{onCreateAccountClick}
	{onLoginClick}
	onLoginSuccess={handleLoginSuccess}
	onSignupSuccess={finish}
/>
