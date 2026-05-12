<script lang="ts">
import Icon from "$components/Icon.svelte";
import IconButton from "$components/IconButton.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { errToast, successToast } from "$lib/utils";

export let username: string;
export let password: string | null;
// idPrefix avoids element-id collisions if two instances ever mount at once.
export let idPrefix = "backup";

let showPassword = false;

async function copyToClipboard(text: string, field: "username" | "password") {
	try {
		await navigator.clipboard.writeText(text);
		trackEvent("backup_credentials_copied", { field });
		successToast($_("backup.copied"));
	} catch (err) {
		errToast($_("backup.copyFailed"));
		console.error("Clipboard write failed", err);
	}
}
</script>

<div class="space-y-3">
	<div>
		<label
			for="{idPrefix}-username"
			class="mb-1 block text-xs font-semibold text-body dark:text-white/70"
		>
			{$_("backup.username")}
		</label>
		<div class="flex items-center gap-2">
			<input
				id="{idPrefix}-username"
				type="text"
				readonly
				value={username}
				class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-primary dark:border-white/20 dark:bg-white/5 dark:text-white"
			/>
			<IconButton
				type="button"
				on:click={() => copyToClipboard(username, "username")}
				style="shrink-0"
				title={$_("backup.copy")}
				aria-label={$_("backup.copy")}
			>
				<Icon
					type="material"
					icon="content_copy"
					w="16"
					h="16"
					class="text-primary dark:text-white"
				/>
			</IconButton>
		</div>
	</div>
	<div>
		<label
			for="{idPrefix}-password"
			class="mb-1 block text-xs font-semibold text-body dark:text-white/70"
		>
			{$_("backup.password")}
		</label>
		<div class="flex items-center gap-2">
			<input
				id="{idPrefix}-password"
				type={showPassword ? "text" : "password"}
				readonly
				value={password || $_("backup.unavailable")}
				class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-primary dark:border-white/20 dark:bg-white/5 dark:text-white"
			/>
			<IconButton
				type="button"
				on:click={() => (showPassword = !showPassword)}
				style="shrink-0"
				title={showPassword ? $_("backup.hide") : $_("backup.show")}
			>
				<Icon
					type="material"
					icon={showPassword ? "visibility_off" : "visibility"}
					w="16"
					h="16"
					class="text-primary dark:text-white"
				/>
			</IconButton>
			{#if password}
				<IconButton
					type="button"
					on:click={() => copyToClipboard(password ?? "", "password")}
					style="shrink-0"
					title={$_("backup.copy")}
				>
					<Icon
						type="material"
						icon="content_copy"
						w="16"
						h="16"
						class="text-primary dark:text-white"
					/>
				</IconButton>
			{/if}
		</div>
	</div>
</div>
<p class="mt-4 text-xs text-body dark:text-white/50">
	{$_("backup.warning")}
</p>
