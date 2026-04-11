<script lang="ts">
import { createEventDispatcher } from "svelte";

import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";
import { successToast } from "$lib/utils";

const dispatch = createEventDispatcher();

let showPassword = false;

async function copyToClipboard(text: string, label: string) {
	try {
		await navigator.clipboard.writeText(text);
		successToast(`${label} copied`);
	} catch {
		// Fallback for older browsers
		const input = document.createElement("input");
		input.value = text;
		document.body.appendChild(input);
		input.select();
		document.execCommand("copy");
		document.body.removeChild(input);
		successToast(`${label} copied`);
	}
}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
	on:click|self={() => dispatch("close")}
>
	<div class="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-dark">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-primary dark:text-white">
				{$_("backup.title")}
			</h2>
			<button
				on:click={() => dispatch("close")}
				class="text-body transition-colors hover:text-primary dark:text-white/50 dark:hover:text-white"
			>
				<Icon type="material" icon="close" w="20" h="20" />
			</button>
		</div>

		<p class="mb-4 text-sm text-body dark:text-white/70">
			{$_("backup.description")}
		</p>

		{#if $session}
			<div class="space-y-3">
				<div>
					<label for="backup-username" class="mb-1 block text-xs font-semibold text-body dark:text-white/70">
						{$_("backup.username")}
					</label>
					<div class="flex items-center gap-2">
						<input
							id="backup-username"
							type="text"
							readonly
							value={$session.username}
							class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-primary dark:border-white/20 dark:bg-white/5 dark:text-white"
						/>
						<button
							on:click={() => copyToClipboard($session?.username ?? "", $_("backup.username"))}
							class="shrink-0 rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10"
							title={$_("backup.copy")}
						>
							<Icon type="material" icon="content_copy" w="16" h="16" class="text-primary dark:text-white" />
						</button>
					</div>
				</div>

				<div>
					<label for="backup-password" class="mb-1 block text-xs font-semibold text-body dark:text-white/70">
						{$_("backup.password")}
					</label>
					<div class="flex items-center gap-2">
						<input
							id="backup-password"
							type={showPassword ? "text" : "password"}
							readonly
							value={$session.password || $_("backup.unavailable")}
							class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-primary dark:border-white/20 dark:bg-white/5 dark:text-white"
						/>
						<button
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
						{#if $session.password}
							<button
								on:click={() => copyToClipboard($session?.password ?? "", $_("backup.password"))}
								class="shrink-0 rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10"
								title={$_("backup.copy")}
							>
								<Icon type="material" icon="content_copy" w="16" h="16" class="text-primary dark:text-white" />
							</button>
						{/if}
					</div>
				</div>
			</div>

			<p class="mt-4 text-xs text-body dark:text-white/50">
				{$_("backup.warning")}
			</p>
		{/if}
	</div>
</div>
