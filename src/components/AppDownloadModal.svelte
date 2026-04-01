<script lang="ts">
import type { AppConfig, StoreKey } from "$lib/apps";
import IconApps from "$lib/icons/IconApps.svelte";
import type { AppIconName } from "$lib/icons/types";

export let app: AppConfig;
export let open = false;

const storeLabels: Record<StoreKey, string> = {
	"app-store": "App Store",
	apk: "APK",
	"f-droid": "F-Droid",
	"google-play": "Google Play",
	"linux-package": "Linux Package",
	obtainium: "Obtainium",
	play: "Google Play",
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
	play: "play",
	web: "web",
	zapstore: "zapstore",
};

function close() {
	open = false;
}

function handleBackdropClick(e: MouseEvent) {
	if (e.target === e.currentTarget) close();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") close();
}

function hideLogoOnError(e: Event) {
	(e.currentTarget as HTMLImageElement).style.display = "none";
}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		on:click={handleBackdropClick}
	>
		<div
			class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
			role="dialog"
			aria-modal="true"
			aria-label="Download {app.name}"
		>
			<div class="mb-5 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<img
						src={app.logo}
						alt={app.name}
						class="h-10 w-10 rounded-xl object-cover"
						on:error={hideLogoOnError}
					/>
					<h2 class="text-lg font-semibold text-body dark:text-white">{app.name}</h2>
				</div>
				<button
					type="button"
					class="rounded-full p-1 text-body transition-colors hover:bg-offwhite dark:text-white dark:hover:bg-white/10"
					on:click={close}
					aria-label="Close"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<ul class="space-y-2">
				{#each app.stores as entry (entry.store + entry.platform)}
					<li>
						<a
							href={entry.url}
							target={entry.store === 'web' ? null : '_blank'}
							rel={entry.store === 'web' ? null : 'noreferrer'}
							class="flex w-full items-center gap-3 rounded-xl bg-offwhite px-4 py-3 text-sm font-semibold text-body transition-colors hover:bg-link hover:text-white dark:bg-white/10 dark:text-white dark:hover:bg-link"
						>
							<IconApps icon={storeIcons[entry.store]} w="20" h="20" />
							<span>{storeLabels[entry.store]}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}
