<script lang="ts">
import { createEventDispatcher } from "svelte";
import { get } from "svelte/store";

import BackupCredentials from "$components/auth/BackupCredentials.svelte";
import LoginForm from "$components/auth/LoginForm.svelte";
import Modal from "$components/Modal.svelte";
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
import { errToast, successToast } from "$lib/utils";

export let id: number;
export let type: SavedItemType;
export let open = false;

const dispatch = createEventDispatcher<{
	saved: undefined;
	close: undefined;
}>();

type View = "choice" | "login" | "backup";
let view: View = "choice";
let creating = false;

$: promptTitleKey =
	type === "area" ? "save.prompt.titleArea" : "save.prompt.titlePlace";
$: promptDescriptionKey =
	type === "area"
		? "save.prompt.descriptionArea"
		: "save.prompt.descriptionPlace";
$: accountCreatedKey =
	type === "area" ? "save.accountCreatedArea" : "save.accountCreatedPlace";

// Inline so Svelte's reactive dependency tracker picks up $_ lexically —
// otherwise locale changes don't retitle the modal until `view` changes.
$: title =
	view === "backup"
		? $_("backup.title")
		: view === "login"
			? $_("login.title")
			: $_(promptTitleKey);

// Reset view state whenever the modal is (re)opened/closed.
$: if (!open) {
	view = "choice";
	creating = false;
}

async function performInitialSave(current: Session) {
	const existing = getSavedList(current, type);
	// No-op if already saved — the atomic POST would still succeed (API
	// dedupes) but we avoid the round-trip and the misleading toast.
	if (existing.includes(id)) {
		dispatch("saved");
		return;
	}
	setSavedList(type, [...existing, id]);
	try {
		const serverList = await addSavedItem(type, current.token, id);
		setSavedList(type, serverList);
		trackEvent("save_item_toggle", {
			saved: serverList.includes(id),
			type,
			source: "save_prompt",
		});
		dispatch("saved");
	} catch (err) {
		setSavedList(type, existing);
		errToast($_("merchant.saveFailed"));
		console.error("SaveAuthPrompt.performInitialSave failed", err);
		throw err;
	}
}

async function handleCreateAccount() {
	if (creating) return;
	creating = true;
	trackEvent("save_prompt_create_account_click", { type });
	try {
		const current = await session.signUp();
		// If the user dismissed the modal while signUp was pending, don't
		// mutate view/show toasts — that would leak "backup" view into the
		// next open. The account still exists locally and can be backed up
		// via the UserMenu.
		if (!open) return;
		// Commit the backup view before the save attempt so a failing save
		// can't strand a new account without the user ever seeing their
		// credentials. performInitialSave toasts on its own errors.
		view = "backup";
		trackEvent("backup_modal_shown", { source: "save_prompt" });
		successToast($_(accountCreatedKey));
		await performInitialSave(current).catch(() => {});
	} catch (err) {
		console.error("SaveAuthPrompt.handleCreateAccount failed", err);
		open = false;
		dispatch("close");
	} finally {
		creating = false;
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
		dispatch("close");
	} catch (err) {
		console.error("SaveAuthPrompt.handleLoginSuccess failed", err);
	}
}

function handleDone() {
	open = false;
	dispatch("close");
}
</script>

<Modal bind:open {title} titleId="save-auth-prompt-title">
	{#if view === "choice"}
		<p class="mb-6 text-sm text-body dark:text-white/70">
			{$_(promptDescriptionKey)}
		</p>
		<div class="space-y-3">
			<button
				type="button"
				on:click={handleCreateAccount}
				disabled={creating}
				class="w-full rounded-lg bg-link px-4 py-2 font-semibold text-white transition-colors hover:bg-hover disabled:opacity-50"
			>
				{$_("save.prompt.createAccount")}
			</button>
			<button
				type="button"
				on:click={() => {
					trackEvent("save_prompt_login_click", { type });
					view = "login";
				}}
				class="w-full rounded-lg border border-link px-4 py-2 font-semibold text-link transition-colors hover:bg-link/10"
			>
				{$_("save.prompt.login")}
			</button>
		</div>
	{:else if view === "login"}
		<LoginForm compact onSuccess={handleLoginSuccess} />
		<button
			type="button"
			on:click={() => (view = "choice")}
			class="mt-4 text-sm text-link transition-colors hover:text-hover"
		>
			← {$_("save.prompt.back")}
		</button>
	{:else if view === "backup" && $session}
		<p class="mb-4 text-sm text-body dark:text-white/70">
			{$_("backup.description")}
		</p>
		<BackupCredentials
			idPrefix="save-prompt"
			username={$session.username}
			password={$session.password}
		/>
		<button
			type="button"
			on:click={handleDone}
			class="mt-6 w-full rounded-lg bg-link px-4 py-2 font-semibold text-white transition-colors hover:bg-hover"
		>
			{$_("save.prompt.done")}
		</button>
	{/if}
</Modal>
