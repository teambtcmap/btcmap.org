<script lang="ts">
import BackupCredentials from "$components/auth/BackupCredentials.svelte";
import Modal from "$components/Modal.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";

export let open = false;

// SaveAuthPrompt fires its own backup_modal_shown with source=save_prompt
// (it reuses BackupCredentials inline, not this modal), so this component
// only needs to report opens from UserMenu.
let wasOpen = false;
$: if (open && !wasOpen) {
	trackEvent("backup_modal_shown", { source: "user_menu" });
}
$: wasOpen = open;
</script>

<Modal bind:open title={$_("backup.title")} titleId="backup-modal-title">
	<p class="mb-4 text-sm text-body dark:text-white/70">
		{$_("backup.description")}
	</p>

	{#if $session}
		<BackupCredentials
			username={$session.username}
			password={$session.password}
		/>
	{/if}
</Modal>
