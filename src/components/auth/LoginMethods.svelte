<script lang="ts">
import { trackEvent } from "#lib/analytics.js";
import type { Login } from "#lib/auth.js";
import { _ } from "#lib/i18n/index.js";
import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";

// Username/password and Nostr as two tabs (#1568), so the two forms never
// share one scroll. The modal, /login and the add-location inline sign-in all
// render this; only their container differs. Always opens on Username: our
// own accounts come first, Nostr is one tap away.

type Method = "username" | "nostr";

type Props = {
	// Unique per page: the tab and panel ids hang off it
	id: string;
	onSuccess: (login: Login) => void | Promise<void>;
	// Passed through to LoginForm (drops the "Don't have an account?" line)
	compact?: boolean;
	// Passed through to the Nostr panel (drops the row hints)
	dense?: boolean;
};

let { id, onSuccess, compact = false, dense = false }: Props = $props();

const METHODS: Method[] = ["username", "nostr"];

let method = $state<Method>("username");
const tabs: Record<Method, HTMLButtonElement | undefined> = $state({
	username: undefined,
	nostr: undefined,
});

function select(next: Method) {
	if (next === method) return;
	method = next;
	trackEvent("login_method_switch", { method: next });
}

// Arrow keys move between the tabs (and select them), per the ARIA tabs
// pattern with automatic activation.
function handleKeydown(event: KeyboardEvent) {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	event.preventDefault();
	const next = METHODS[(METHODS.indexOf(method) + 1) % METHODS.length];
	select(next);
	tabs[next]?.focus();
}

const tabClass =
	"flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-link focus-visible:outline-none";
const tabOn =
	"bg-white text-primary shadow-sm dark:bg-white/15 dark:text-white";
const tabOff =
	"text-body hover:text-primary dark:text-white/60 dark:hover:text-white";
</script>

<!-- gap, not space-y: a hidden last panel would leave a trailing margin -->
<div class="flex flex-col gap-4">
	<div
		role="tablist"
		aria-label={$_("login.methodLabel")}
		class="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.08]"
	>
		{#each METHODS as tab (tab)}
			<button
				bind:this={tabs[tab]}
				type="button"
				role="tab"
				id="{id}-tab-{tab}"
				aria-selected={method === tab}
				aria-controls="{id}-panel-{tab}"
				tabindex={method === tab ? 0 : -1}
				onclick={() => select(tab)}
				onkeydown={handleKeydown}
				class="{tabClass} {method === tab ? tabOn : tabOff}"
			>
				<!-- Nostr is a proper name: not translated -->
				{tab === "username" ? $_("login.username") : "Nostr"}
			</button>
		{/each}
	</div>

	<!-- Both panels exist for the tabs' aria-controls, but only the selected
	     one has content: leaving the Nostr tab tears its panel down, and its
	     onDestroy cancels a pairing in flight. -->
	{#each METHODS as tab (tab)}
		<div
			role="tabpanel"
			id="{id}-panel-{tab}"
			aria-labelledby="{id}-tab-{tab}"
			hidden={method !== tab}
		>
			{#if method === tab}
				{#if tab === "username"}
					<LoginForm {compact} {onSuccess} />
				{:else}
					<NostrLoginForm {onSuccess} {dense} />
				{/if}
			{/if}
		</div>
	{/each}
</div>
