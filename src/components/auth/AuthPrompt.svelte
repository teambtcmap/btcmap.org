<script lang="ts">
import { _ } from "#lib/i18n/index.js";
import type { Session } from "#lib/session.js";
import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";
import SignupForm from "$components/auth/SignupForm.svelte";
import Modal from "$components/Modal.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";

// In-place sign-in modal: a choice screen (create account / log in) that
// switches to the signup or login forms. Callers own what happens after
// authentication (SaveAuthPrompt saves the item, PhotoAuthPrompt opens the
// photo picker).
type Props = {
	open?: boolean;
	titleId: string;
	// Title and description of the choice screen
	title: string;
	description: string;
	onCreateAccountClick?: () => void;
	onLoginClick?: () => void;
	onLoginSuccess: (session: Session) => void | Promise<void>;
	onSignupSuccess: (session: Session) => void | Promise<void>;
};

let {
	open = $bindable(false),
	titleId,
	title,
	description,
	onCreateAccountClick,
	onLoginClick,
	onLoginSuccess,
	onSignupSuccess,
}: Props = $props();

type View = "choice" | "login" | "signup";
let view = $state<View>("choice");

// $_ is read inside the derived so a locale change retitles the modal.
const modalTitle = $derived(
	view === "signup"
		? $_("signup.title")
		: view === "login"
			? $_("login.title")
			: title,
);

// Reset view state whenever the modal is (re)opened/closed.
$effect.pre(() => {
	if (!open) {
		view = "choice";
	}
});
</script>

<Modal bind:open title={modalTitle} {titleId}>
	{#if view === "choice"}
		<p class="mb-6 text-sm text-body dark:text-white/70">
			{description}
		</p>
		<div class="space-y-3">
			<PrimaryButton
				type="button"
				onclick={() => {
					onCreateAccountClick?.();
					view = "signup";
				}}
				style="w-full rounded-lg px-4 py-2"
			>
				{$_("authPrompt.createAccount")}
			</PrimaryButton>
			<button
				type="button"
				onclick={() => {
					onLoginClick?.();
					view = "login";
				}}
				class="w-full rounded-lg border border-link px-4 py-2 font-semibold text-link transition-colors hover:bg-link/10"
			>
				{$_("authPrompt.login")}
			</button>
		</div>
	{:else if view === "login"}
		<LoginForm compact onSuccess={onLoginSuccess} />
		<div class="my-4 flex items-center gap-3">
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
			<span class="text-xs text-body dark:text-white/50">
				{$_("login.otherMethods")}
			</span>
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
		</div>
		<NostrLoginForm onSuccess={onLoginSuccess} />
		<TextLink
			type="button"
			onclick={() => (view = "choice")}
			style="mt-4 text-sm"
		>
			← {$_("authPrompt.back")}
		</TextLink>
	{:else if view === "signup"}
		<SignupForm onSuccess={onSignupSuccess} />
		<TextLink
			type="button"
			onclick={() => (view = "choice")}
			style="mt-4 text-sm"
		>
			← {$_("authPrompt.back")}
		</TextLink>
	{/if}
</Modal>
