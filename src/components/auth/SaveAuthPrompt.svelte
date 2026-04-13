<script lang="ts">
import { createEventDispatcher } from "svelte";

import LoginForm from "$components/auth/LoginForm.svelte";
import Icon from "$components/Icon.svelte";
import Modal from "$components/Modal.svelte";
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import type { SavedItemType } from "$lib/savedItems";
import { getSavedList, putSavedList, setSavedList } from "$lib/savedItems";
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
let showPassword = false;

$: title =
	view === "backup"
		? $_("backup.title")
		: view === "login"
			? $_("login.title")
			: $_("save.prompt.title");

// Reset view state whenever the modal is (re)opened/closed.
$: if (!open) {
	view = "choice";
	showPassword = false;
}

async function performInitialSave(current: Session) {
	const existing = getSavedList(current, type);
	const nextList = existing.includes(id) ? existing : [...existing, id];
	setSavedList(type, nextList);
	try {
		const serverList = await putSavedList(type, current.token, nextList);
		setSavedList(type, serverList);
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
	try {
		const current = await session.signUp();
		// Commit the backup view before the save attempt so a failing save
		// can't strand a new account without the user ever seeing their
		// credentials. performInitialSave toasts on its own errors.
		view = "backup";
		successToast($_("save.accountCreated"));
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
		const headers = { Authorization: `Bearer ${current.token}` };
		const [placesRes, areasRes] = await Promise.allSettled([
			api.get("/api/session/saved-places", { headers }),
			api.get("/api/session/saved-areas", { headers }),
		]);
		if (
			placesRes.status === "fulfilled" &&
			Array.isArray(placesRes.value.data)
		) {
			const ids = placesRes.value.data.map((p: { id: number }) => p.id);
			session.setSavedPlaces(ids);
		}
		if (areasRes.status === "fulfilled" && Array.isArray(areasRes.value.data)) {
			const ids = areasRes.value.data.map((a: { id: number }) => a.id);
			session.setSavedAreas(ids);
		}

		// Re-read the freshly populated session so performInitialSave sees the
		// server-side saved lists and merges (not overwrites) the new id.
		let refreshed: Session | null = null;
		const unsub = session.subscribe((s) => {
			refreshed = s;
		});
		unsub();
		if (!refreshed) throw new Error("session missing after login");

		await performInitialSave(refreshed);
		open = false;
		dispatch("close");
	} catch (err) {
		console.error("SaveAuthPrompt.handleLoginSuccess failed", err);
	}
}

async function copyToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		successToast($_("backup.copied"));
	} catch (err) {
		console.error("Clipboard write failed", err);
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
			{$_("save.prompt.description")}
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
				on:click={() => (view = "login")}
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
		<div class="space-y-3">
			<div>
				<label
					for="save-prompt-username"
					class="mb-1 block text-xs font-semibold text-body dark:text-white/70"
				>
					{$_("backup.username")}
				</label>
				<div class="flex items-center gap-2">
					<input
						id="save-prompt-username"
						type="text"
						readonly
						value={$session.username}
						class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-primary dark:border-white/20 dark:bg-white/5 dark:text-white"
					/>
					<button
						type="button"
						on:click={() => copyToClipboard($session?.username ?? "")}
						class="shrink-0 rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10"
						title={$_("backup.copy")}
					>
						<Icon
							type="material"
							icon="content_copy"
							w="16"
							h="16"
							class="text-primary dark:text-white"
						/>
					</button>
				</div>
			</div>
			<div>
				<label
					for="save-prompt-password"
					class="mb-1 block text-xs font-semibold text-body dark:text-white/70"
				>
					{$_("backup.password")}
				</label>
				<div class="flex items-center gap-2">
					<input
						id="save-prompt-password"
						type={showPassword ? "text" : "password"}
						readonly
						value={$session.password}
						class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-primary dark:border-white/20 dark:bg-white/5 dark:text-white"
					/>
					<button
						type="button"
						on:click={() => (showPassword = !showPassword)}
						class="shrink-0 rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10"
						title={showPassword ? $_("backup.hide") : $_("backup.show")}
					>
						<Icon
							type="material"
							icon={showPassword ? "visibility_off" : "visibility"}
							w="16"
							h="16"
							class="text-primary dark:text-white"
						/>
					</button>
					<button
						type="button"
						on:click={() => copyToClipboard($session?.password ?? "")}
						class="shrink-0 rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10"
						title={$_("backup.copy")}
					>
						<Icon
							type="material"
							icon="content_copy"
							w="16"
							h="16"
							class="text-primary dark:text-white"
						/>
					</button>
				</div>
			</div>
		</div>
		<p class="mt-4 text-xs text-body dark:text-white/50">
			{$_("backup.warning")}
		</p>
		<button
			type="button"
			on:click={handleDone}
			class="mt-6 w-full rounded-lg bg-link px-4 py-2 font-semibold text-white transition-colors hover:bg-hover"
		>
			{$_("save.prompt.done")}
		</button>
	{/if}
</Modal>
