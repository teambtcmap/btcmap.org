<script lang="ts">
import Modal from "$components/Modal.svelte";
import type { AppConfig, StoreKey } from "$lib/apps";
import IconApps from "$lib/icons/IconApps.svelte";
import type { AppIconName } from "$lib/icons/types";

export let app: AppConfig;
export let open = false;

const platformLabels: Record<string, string> = {
	android: "Android",
	ios: "iOS",
	web: "Web",
	linux: "Linux",
	windows: "Windows",
	mac: "macOS",
};

$: modalTitle =
	app.tag === "btcmap"
		? (platformLabels[app.stores[0]?.platform] ?? app.name)
		: app.name;

const storeLabels: Record<StoreKey, { label: string; icon: AppIconName }> = {
	"app-store": { label: "App Store", icon: "app-store" },
	apk: { label: "APK", icon: "apk" },
	"f-droid": { label: "F-Droid", icon: "f-droid" },
	"google-play": { label: "Google Play", icon: "google-play" },
	"linux-package": { label: "Linux Package", icon: "linux-package" },
	obtainium: { label: "Obtainium", icon: "obtainium" },
	web: { label: "Web App", icon: "web" },
	zapstore: { label: "Zapstore", icon: "zapstore" },
};
</script>

<Modal bind:open title={modalTitle} titleId="app-download-modal-title">
	<ul class="space-y-2">
		{#each app.stores as entry (entry.store + entry.platform)}
			<li>
				<a
					href={entry.url}
					target={entry.store === 'web' ? null : '_blank'}
					rel={entry.store === 'web' ? null : 'noopener noreferrer'}
					class="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100 text-body dark:hover:bg-white/5 dark:text-white"
				>
					<IconApps icon={storeLabels[entry.store].icon} w="20" h="20" />
					<span class="text-sm font-medium">{storeLabels[entry.store].label}</span>
				</a>
			</li>
		{/each}
	</ul>
</Modal>
