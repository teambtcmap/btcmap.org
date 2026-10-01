<script lang="ts">
import { get } from "svelte/store";

import AuthPrompt from "$components/auth/AuthPrompt.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { SavedItemType } from "$lib/savedItems";
import {
	addSavedItem,
	getSavedList,
	hydrateSavedFromServer,
	setSavedList,
} from "$lib/savedItems";
import type { Session } from "$lib/session";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

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

async function performInitialSave(current: Session) {
	const existing = getSavedList(current, type);
	// No-op if already saved — the atomic POST would still succeed (API
	// dedupes) but we avoid the round-trip and the misleading toast.
	if (existing.includes(id)) return;

	setSavedList(type, [...existing, id]);
	try {
		const serverList = await addSavedItem(type, current.token, id);
		setSavedList(type, serverList);
		trackEvent("save_item_toggle", {
			saved: serverList.includes(id),
			type,
			source: "save_prompt",
		});
	} catch (err) {
		setSavedList(type, existing);
		errToast($_("merchant.saveFailed"));
		console.error("SaveAuthPrompt.performInitialSave failed", err);
		throw err;
	}
}

// A fresh account has nothing saved yet, so no hydrate round-trip: save
// the item straight away. Close either way: the account exists now, and
// leaving the form open would invite a second signup. performInitialSave
// toasts its own errors; the user is logged in and can press Save again.
async function handleSignupSuccess(current: Session) {
	try {
		await performInitialSave(current);
	} catch (err) {
		console.error("SaveAuthPrompt.handleSignupSuccess failed", err);
	} finally {
		open = false;
	}
}

async function handleLoginSuccess(current: Session) {
	try {
		// Best-effort hydrate so the local saved lists reflect the server
		// before we attempt the save. The atomic POST in performInitialSave
		// doesn't rely on a complete local list, so a partial hydrate
		// failure won't clobber the server's saved items — it just means
		// the short-circuit "already saved" check might miss and we pay for
		// an extra (idempotent) POST.
		await hydrateSavedFromServer(current.token);
		const refreshed = get(session);
		if (!refreshed) throw new Error("session missing after login");
		await performInitialSave(refreshed);
		open = false;
	} catch (err) {
		console.error("SaveAuthPrompt.handleLoginSuccess failed", err);
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
