<script lang="ts">
import { _ } from "svelte-i18n";

import AppDownloadModal from "$components/AppDownloadModal.svelte";
import Footer from "$components/layout/Footer.svelte";
import Header from "$components/layout/Header.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import type { AppConfig } from "$lib/apps";
import { appConfigs } from "$lib/apps";
import IconApps from "$lib/icons/IconApps.svelte";
import type { AppIconName } from "$lib/icons/types";
import { theme } from "$lib/theme";

import { goto } from "$app/navigation";
import { resolve } from "$app/paths";

const btcmapApps = appConfigs.filter((a) => a.tag === "btcmap");

let activeApp: AppConfig | null = null;
let modalOpen = false;

const platformIcons: Record<string, AppIconName> = {
	android: "android",
	ios: "ios",
	web: "web",
};

const platformLabels: Record<string, string> = {
	android: "Android",
	ios: "iOS",
	web: "Web",
};

$: if (!modalOpen) activeApp = null;

function openAppModal(app: AppConfig) {
	if (app.stores.length === 1) {
		const store = app.stores[0];
		if (store.store === "web") {
			goto(store.url);
		} else {
			window.open(store.url, "_blank", "noopener,noreferrer");
		}
	} else {
		activeApp = app;
		modalOpen = true;
	}
}
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta name="twitter:title" content="BTC Map" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="street-map bg-teal dark:bg-dark">
	<img
		src="/images/street-map.svg"
		alt={$_('home.roadsAlt')}
		class="absolute top-0 right-0 xl:hidden dark:opacity-10"
	/>
	<Header />
	{#if activeApp}
		<AppDownloadModal app={activeApp} bind:open={modalOpen} />
	{/if}

	<div class="relative mx-auto w-10/12 xl:w-[1200px]">
		<section id="hero" class="items-center justify-between pt-10 pb-20 xl:flex xl:pt-0">
			<div class="mx-auto w-full xl:mx-0 xl:w-[500px]">
				{#if typeof window !== 'undefined'}
					<h1
						class="{$theme === 'dark'
							? 'text-white'
							: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl xl:text-left"
					>
						{$_('home.hero')}
					</h1>
				{:else}
					<HeaderPlaceholder />
				{/if}
				<div class="my-8 flex flex-wrap justify-center gap-4">
					<a
						href={resolve('/map')}
						class="rounded-full bg-link px-7 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-hover"
						>{$_('home.openMap')}</a
					>
					<a
						href={resolve('/add-location')}
						class="rounded-full bg-link px-7 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-hover"
						>{$_('home.addLocation')}</a
					>
				</div>
			<div
				class="my-8 flex flex-wrap justify-center rounded-2xl bg-white/30 py-6 dark:bg-white/[0.15]"
			>
				{#each btcmapApps as app (app.id)}
					{@const platform = app.stores[0]?.platform}
					{@const icon = platformIcons[platform]}
					{@const label = platformLabels[platform] ?? platform}
					{#if icon}
						<div
							class="mx-2 my-2 space-y-1 text-center font-semibold text-body md:my-0 dark:text-white"
						>
							<p>{label}</p>
							<button
								type="button"
								aria-label={platform === 'web'
									? $_('home.openWebAppAria', { values: { type: label } })
									: $_('home.downloadForAria', { values: { type: label } })}
								class="mx-auto inline-flex cursor-pointer rounded-full bg-link p-3 text-white transition-colors hover:bg-hover"
								on:click={() => openAppModal(app)}
							>
								<IconApps w="32" h="32" {icon} />
							</button>
						</div>
					{/if}
				{/each}
			</div>
				<h2 class="text-center text-xl font-semibold text-primary xl:text-left dark:text-white">
					{@html $_('home.description', {
						values: {
							osmLink: `<a href="https://www.openstreetmap.org/about" target="_blank" rel="noreferrer" class="text-link transition-colors hover:text-hover">OpenStreetMap</a>`
						}
					})}
					<br /><br />
					{$_('home.openSource')}
					<br /><br />
					{$_('home.hashtag')}
				</h2>
			</div>
			{#if typeof window !== 'undefined'}
				<a href={resolve('/map')}>
					<img
						src={$theme === 'dark'
							? '/images/hero-mobile-example-dark.webp'
							: '/images/hero-mobile-example.webp'}
						alt={$_('home.mobileExampleAlt')}
						class="mx-auto mt-10 w-80 drop-shadow-2xl xl:mx-0 xl:mt-0"
					/>
				</a>
			{/if}
		</section>

		<Footer />
	</div>
</div>

{#if typeof window !== 'undefined'}
	{#if $theme === 'dark'}
		<style>
			@media (min-width: 1280px) {
				.street-map {
					background-image: url(/images/street-map-dark.svg);
				}
			}
		</style>
	{:else}
		<style>
			@media (min-width: 1280px) {
				.street-map {
					background-image: url(/images/street-map.svg);
				}
			}
		</style>
	{/if}
{/if}

<style>
	@media (min-width: 1280px) {
		.street-map {
			background-position: right;
			background-repeat: no-repeat;
			background-size: 65%;
		}
	}
</style>
