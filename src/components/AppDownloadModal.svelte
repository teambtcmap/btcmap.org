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

const storeLabels: Record<StoreKey, string> = {
	"app-store": "App Store",
	apk: "APK",
	"f-droid": "F-Droid",
	"google-play": "Google Play",
	"linux-package": "Linux Package",
	obtainium: "Obtainium",
	web: "Web App",
	zapstore: "Zapstore",
};

const storeIcons: Record<StoreKey, AppIconName> = {
	"app-store": "app-store",
	apk: "apk",
	"f-droid": "f-droid",
	"google-play": "google-play",
	"linux-package": "linux-package",
	obtainium: "obtainium",
	web: "web",
	zapstore: "zapstore",
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
					<IconApps icon={storeIcons[entry.store]} w="20" h="20" />
					<span class="text-sm font-medium">{storeLabels[entry.store]}</span>
				</a>
			</li>
		{/each}
	</ul>
</Modal>
