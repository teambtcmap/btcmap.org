<script lang="ts">
import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";
import SignupForm from "$components/auth/SignupForm.svelte";
import Modal from "$components/Modal.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
import { _ } from "$lib/i18n";
import { hydrateSavedFromServer } from "$lib/savedItems";
import type { Session } from "$lib/session";

// Sign-in for adding a place photo, in place like SaveAuthPrompt: leaving
// for /login dropped the user on /user/activity, away from the place.
type Props = {
	open?: boolean;
	onAuthenticated: () => void;
};

let { open = $bindable(false), onAuthenticated }: Props = $props();

type View = "choice" | "login" | "signup";
let view = $state<View>("choice");

const title = $derived(
	view === "signup"
		? $_("signup.title")
		: view === "login"
			? $_("login.title")
			: $_("placePhotos.promptTitle"),
);

$effect.pre(() => {
	if (!open) view = "choice";
});

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

<Modal bind:open {title} titleId="photo-auth-prompt-title">
	{#if view === "choice"}
		<p class="mb-6 text-sm text-body dark:text-white/70">
			{$_("placePhotos.promptDescription")}
		</p>
		<div class="space-y-3">
			<PrimaryButton
				type="button"
				onclick={() => (view = "signup")}
				style="w-full rounded-lg px-4 py-2"
			>
				{$_("save.prompt.createAccount")}
			</PrimaryButton>
			<button
				type="button"
				onclick={() => (view = "login")}
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
		<TextLink type="button" onclick={() => (view = "choice")} style="mt-4 text-sm">
			← {$_("save.prompt.back")}
		</TextLink>
	{:else if view === "signup"}
		<SignupForm onSuccess={finish} />
		<TextLink type="button" onclick={() => (view = "choice")} style="mt-4 text-sm">
			← {$_("save.prompt.back")}
		</TextLink>
	{/if}
</Modal>
