<script lang="ts">
import { get } from "svelte/store";

import { trackEvent } from "#lib/analytics.js";
import { errorStatus } from "#lib/apiError.js";
import type { Login } from "#lib/auth.js";
import type { AuthedClient } from "#lib/authedApi.js";
import { authedClient } from "#lib/authedApi.js";
import { _ } from "#lib/i18n/index.js";
import type { SavedItemType } from "#lib/savedItems.js";
import { addSavedItem, getSavedList, setSavedList } from "#lib/savedItems.js";
import type { Session } from "#lib/session.js";
import { session } from "#lib/session.js";
import { errToast } from "#lib/utils.js";
import AuthPrompt from "$components/auth/AuthPrompt.svelte";

type Props = {
	id: number;
	type: SavedItemType;
	open?: boolean;
};

let { id, type, open = $bindable(false) }: Props = $props();

const promptTitleKey = $derived(
	type === "area" ? "save.prompt.titleArea" : "save.prompt.titlePlace",
);
const promptDescriptionKey = $derived(
	type === "area"
		? "save.prompt.descriptionArea"
		: "save.prompt.descriptionPlace",
);

// `client` is the account that just signed up or logged in: the save, its
// list update and its rollback all belong to it.
async function performInitialSave(current: Session, client: AuthedClient) {
	const existing = getSavedList(current, type);
	// No-op if already saved — the atomic POST would still succeed (API
	// dedupes) but we avoid the round-trip and the misleading toast.
	if (existing.includes(id)) return;

	setSavedList(type, [...existing, id], client);
	try {
		const serverList = await addSavedItem(type, id, client);
		setSavedList(type, serverList, client);
		trackEvent("save_item_toggle", {
			saved: serverList.includes(id),
			type,
			source: "save_prompt",
		});
	} catch (err) {
		setSavedList(type, existing, client);
		errToast($_("merchant.saveFailed"));
		console.error("SaveAuthPrompt.performInitialSave failed", errorStatus(err));
		throw err;
	}
}

// A fresh account has nothing saved yet, so no hydrate round-trip: save
// the item straight away. Close either way: the account exists now, and
// leaving the form open would invite a second signup. performInitialSave
// toasts its own errors; the user is logged in and can press Save again.
async function handleSignupSuccess(current: Session) {
	try {
		await performInitialSave(current, authedClient());
	} catch (err) {
		console.error(
			"SaveAuthPrompt.handleSignupSuccess failed",
			errorStatus(err),
		);
	} finally {
		open = false;
	}
}

async function handleLoginSuccess(login: Login) {
	// The prompt stays open while the lists load, and Back leads to another
	// login: a second account must not receive this account's save.
	const client = authedClient();
	try {
		// Let the login's saved lists land before the save, so an item
		// already saved isn't saved again. The atomic POST in
		// performInitialSave doesn't rely on a complete local list, so a
		// failed load won't clobber the server's saved items — it just
		// means the short-circuit "already saved" check might miss and we
		// pay for an extra (idempotent) POST.
		await login.savedItems;
		if (!client.stillCurrent()) return;
		const refreshed = get(session);
		if (!refreshed) throw new Error("session missing after login");
		await performInitialSave(refreshed, client);
		open = false;
	} catch (err) {
		console.error("SaveAuthPrompt.handleLoginSuccess failed", errorStatus(err));
	}
}
</script>

<AuthPrompt
	bind:open
	titleId="save-auth-prompt-title"
	title={$_(promptTitleKey)}
	description={$_(promptDescriptionKey)}
	onCreateAccountClick={() =>
		trackEvent("save_prompt_create_account_click", { type })}
	onLoginClick={() => trackEvent("save_prompt_login_click", { type })}
	onLoginSuccess={handleLoginSuccess}
	onSignupSuccess={handleSignupSuccess}
/>
