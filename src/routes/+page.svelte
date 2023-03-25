<script>
	import { Header, Footer, PrimaryButton, Icon } from '$comp';
	import { socials, apps, theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';
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
		class="absolute top-0 right-0 dark:opacity-10 xl:hidden"
	/>
	<Header />
	<div class="relative mx-auto w-10/12 xl:w-[1200px]">
		<section id="hero" class="items-center justify-between pb-20 pt-10 xl:flex xl:pt-0">
			<div class="mx-auto w-full xl:mx-0 xl:w-[500px]">
				<h1
					class="gradient text-center text-4xl font-semibold !leading-tight md:text-5xl xl:text-left"
				>
					Easily find places to spend sats anywhere on the planet.
				</h1>
				<div
					class="my-16 flex flex-wrap justify-center rounded-2xl bg-white/30 py-6 dark:bg-white/[0.15]"
				>
					{#each $apps as app}
						<div
							class="my-2 mx-2 space-y-1 text-center font-semibold text-body dark:text-white md:my-0"
						>
							<p>{app.type}</p>
							<a
								href={app.link}
								target={app.type === 'Web' ? '_self' : '_blank'}
								rel="noreferrer"
								class="block rounded-full bg-link p-3 text-white transition-colors hover:bg-hover"
							>
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
				<h2 class="text-center text-xl font-semibold text-primary dark:text-white xl:text-left">
					Our apps and the underlying data are free and open source.
					<br /><br />
					We use
					<a
						href="https://www.openstreetmap.org/about"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">OpenStreetMap</a
					> to properly tag places where you can spend bitcoin and we display that data in our beautiful
					apps.
				</h2>
			</div>
			{#if typeof window !== 'undefined'}
				<img
					src={detectTheme() === 'dark' || $theme === 'dark'
						? '/images/hero-mobile-example-dark.png'
						: '/images/hero-mobile-example.png'}
					alt="mobile example"
					class="mx-auto mt-10 w-80 drop-shadow-2xl xl:mx-0 xl:mt-0"
				/>
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
