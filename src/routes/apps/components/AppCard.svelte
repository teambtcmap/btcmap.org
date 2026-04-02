<script lang="ts">
import AppDownloadModal from "$components/AppDownloadModal.svelte";
import type { AppConfig } from "$lib/apps";
import IconApps from "$lib/icons/IconApps.svelte";
import type { AppIconName } from "$lib/icons/types";

import { goto } from "$app/navigation";

export let app: AppConfig;

let modalOpen = false;

const fallbackSrc =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='112' height='112' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='3'/%3E%3Cpath d='M9 12h6M12 9v6'/%3E%3C/svg%3E";

const platformIcons: Record<string, AppIconName> = {
	android: "android",
	ios: "ios",
	web: "web",
};

function handleImgError(e: Event) {
	(e.currentTarget as HTMLImageElement).src = fallbackSrc;
}

const platformLabels: Record<string, string> = {
	android: "Android",
	ios: "iOS",
	web: "Web",
	linux: "Linux",
	windows: "Windows",
	mac: "macOS",
};

$: platformsLabel = [...new Set(app.stores.map((s) => s.platform))]
	.map((p) => platformLabels[p] ?? p)
	.join(" | ");

function handleClick() {
	if (app.stores.length === 1) {
		const store = app.stores[0];
		if (store.store === "web") {
			goto(store.url);
		} else {
			window.open(store.url, "_blank", "noopener,noreferrer");
		}
	} else {
		modalOpen = true;
	}
}
</script>

<div>
	{#if app.tag === 'coming-soon'}
		<div class="opacity-50">
			<div
				class="relative mb-5 flex h-60 items-center justify-center rounded-2xl bg-offwhite dark:bg-white/[0.15]"
			>
				{#if app.sponsor}
					<span
						class="absolute top-3 right-3 rounded-full bg-link px-2 py-0.5 text-xs font-semibold text-white"
					>
						Sponsor
					</span>
				{/if}
				<img
					src={app.logo}
					alt={app.name}
					class="h-28 w-28 rounded-2xl object-cover"
					on:error={handleImgError}
				/>
			</div>
			<p class="text-2xl font-semibold text-link">{app.name}</p>
			<p class="text-xl font-normal text-link">{platformsLabel}</p>
		</div>
	{:else}
		<button
			type="button"
			class="group w-full cursor-pointer text-left"
			on:click={handleClick}
			aria-label="Download {app.name}"
		>
			<div
				class="relative mb-5 flex h-60 items-center justify-center rounded-2xl bg-offwhite transition-colors group-hover:bg-link/10 dark:bg-white/[0.15] dark:group-hover:bg-link/20"
			>
				{#if app.sponsor}
					<span
						class="absolute top-3 right-3 rounded-full bg-link px-2 py-0.5 text-xs font-semibold text-white"
					>
						Sponsor
					</span>
				{/if}
				{#if app.tag === 'btcmap' && platformIcons[app.stores[0]?.platform]}
					<span class="inline-flex rounded-full bg-link p-6 text-white">
						<IconApps w="56" h="56" icon={platformIcons[app.stores[0].platform]} />
					</span>
				{:else}
					<img
						src={app.logo}
						alt={app.name}
						class="h-28 w-28 rounded-2xl object-cover"
						on:error={handleImgError}
					/>
				{/if}
			</div>
			<p class="text-2xl font-semibold text-link transition-colors group-hover:text-hover">
				{app.tag === 'btcmap' ? platformsLabel : app.name}
			</p>
			{#if app.tag !== 'btcmap'}
				<p class="text-xl font-normal text-link transition-colors group-hover:text-hover">{platformsLabel}</p>
			{/if}
		</button>

		<AppDownloadModal bind:open={modalOpen} {app} />
	{/if}
</div>
