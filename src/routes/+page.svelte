<script lang="ts">
	import Footer from '$components/layout/Footer.svelte';
	import Header from '$components/layout/Header.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import Icon from '$components/Icon.svelte';
	import { apps, theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="street-map bg-teal dark:bg-dark">
	<img
		src="/images/street-map.svg"
		alt="roads"
		class="absolute top-0 right-0 xl:hidden dark:opacity-10"
	/>
	<Header />
	<div class="relative mx-auto w-10/12 xl:w-[1200px]">
		<section id="hero" class="items-center justify-between pt-10 pb-20 xl:flex xl:pt-0">
			<div class="mx-auto w-full xl:mx-0 xl:w-[500px]">
				{#if typeof window !== 'undefined'}
					<h1
						class="{detectTheme() === 'dark' || $theme === 'dark'
							? 'text-white'
							: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl xl:text-left"
					>
						Find places to spend sats wherever you are.
					</h1>
				{:else}
					<HeaderPlaceholder />
				{/if}
				<div class="my-8 flex flex-wrap justify-center gap-4">
					<a
						href={resolve('/map')}
						class="rounded-full bg-link px-7 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-hover"
						>Open Map</a
					>
					<a
						href={resolve('/add-location')}
						class="rounded-full bg-link px-7 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-hover"
						>Add Location</a
					>
				</div>
				<div
					class="my-8 flex flex-wrap justify-center rounded-2xl bg-white/30 py-6 dark:bg-white/[0.15]"
				>
					{#each $apps as app (app.link)}
						<div
							class="mx-2 my-2 space-y-1 text-center font-semibold text-body md:my-0 dark:text-white"
						>
							<p>{app.type}</p>
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={app.link}
								target={app.type === 'Web' ? null : '_blank'}
								rel={app.type === 'Web' ? null : 'noreferrer'}
								aria-label={`Download for ${app.type}`}
								class="block rounded-full bg-link p-3 text-white transition-colors hover:bg-hover"
							>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
								<Icon
									w="32"
									h="32"
									style={app.icon === 'play' ? 'pl-0.5' : ''}
									icon={app.icon}
									type="apps"
								/>
							</a>
						</div>
					{/each}
				</div>
				<h2 class="text-center text-xl font-semibold text-primary xl:text-left dark:text-white">
					We use
					<a
						href="https://www.openstreetmap.org/about"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">OpenStreetMap</a
					>
					to tag places that accept bitcoin and we display those merchants in our beautiful apps.
					<br /><br />
					Our apps and the underlying data are free and open source.
					<br /><br />
					#SPEDN ✊
				</h2>
			</div>
			{#if typeof window !== 'undefined'}
				<a href={resolve('/map')}>
					<img
						src={detectTheme() === 'dark' || $theme === 'dark'
							? '/images/hero-mobile-example-dark.webp'
							: '/images/hero-mobile-example.webp'}
						alt="mobile example"
						class="mx-auto mt-10 w-80 drop-shadow-2xl xl:mx-0 xl:mt-0"
					/>
				</a>
			{/if}
		</section>

		<Footer />
	</div>
</div>

{#if typeof window !== 'undefined'}
	{#if detectTheme() === 'dark' || $theme === 'dark'}
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
