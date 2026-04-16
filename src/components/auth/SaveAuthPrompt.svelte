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
	getSavedList,
	hydrateSavedFromServer,
	putSavedList,
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
	const nextList = existing.includes(id) ? existing : [...existing, id];
	setSavedList(type, nextList);
	try {
		const serverList = await putSavedList(type, current.token, nextList);
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
		const hydrated = await hydrateSavedFromServer(current.token);

		// Don't save on top of a failed hydrate for this type — the local list
		// is stale and putSavedList would wipe the user's real server-side
		// saved list, leaving only the pending id.
		if (!hydrated[type]) {
			errToast($_("merchant.saveFailed"));
			return;
		}

		// Re-read the freshly populated session so performInitialSave sees the
		// server-side saved lists and merges (not overwrites) the new id.
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
