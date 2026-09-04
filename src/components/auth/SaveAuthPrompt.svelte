<script lang="ts">
import { get } from "svelte/store";

import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";
import SignupForm from "$components/auth/SignupForm.svelte";
import Modal from "$components/Modal.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
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

type View = "choice" | "login" | "signup";
let view = $state<View>("choice");

const promptTitleKey = $derived(
	type === "area" ? "save.prompt.titleArea" : "save.prompt.titlePlace",
);
const promptDescriptionKey = $derived(
	type === "area"
		? "save.prompt.descriptionArea"
		: "save.prompt.descriptionPlace",
);

// $_ is read inside the derived so a locale change retitles the modal.
const title = $derived(
	view === "signup"
		? $_("signup.title")
		: view === "login"
			? $_("login.title")
			: $_(promptTitleKey),
);

// Reset view state whenever the modal is (re)opened/closed.
$effect.pre(() => {
	if (!open) {
		view = "choice";
	}
});

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

<Modal bind:open {title} titleId="save-auth-prompt-title">
	{#if view === "choice"}
		<p class="mb-6 text-sm text-body dark:text-white/70">
			{$_(promptDescriptionKey)}
		</p>
		<div class="space-y-3">
			<PrimaryButton
				type="button"
				onclick={() => {
					trackEvent("save_prompt_create_account_click", { type });
					view = "signup";
				}}
				style="w-full rounded-lg px-4 py-2"
			>
				{$_("save.prompt.createAccount")}
			</PrimaryButton>
			<button
				type="button"
				onclick={() => {
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
		<div class="my-4 flex items-center gap-3">
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
			<span class="text-xs text-body dark:text-white/50">
				{$_("login.otherMethods")}
			</span>
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
		</div>
		<NostrLoginForm onSuccess={handleLoginSuccess} />
		<TextLink
			type="button"
			onclick={() => (view = "choice")}
			style="mt-4 text-sm"
		>
			← {$_("save.prompt.back")}
		</TextLink>
	{:else if view === "signup"}
		<SignupForm onSuccess={handleSignupSuccess} />
		<TextLink
			type="button"
			onclick={() => (view = "choice")}
			style="mt-4 text-sm"
		>
			← {$_("save.prompt.back")}
		</TextLink>
	{/if}
</Modal>
