<script lang="ts">
import BackupCredentials from "$components/auth/BackupCredentials.svelte";
import Modal from "$components/Modal.svelte";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";

export let open = false;
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
