<script>
	import { Header, Footer, PrimaryButton, Icon } from '$comp';
	import { socials, apps } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="bg-teal street-map">
	<img src="/images/street-map.svg" alt="roads" class="xl:hidden absolute top-0 right-0" />
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto relative">
		<section id="hero" class="pb-20 pt-10 xl:pt-0 xl:flex justify-between items-center">
			<div class="w-full xl:w-[500px] mx-auto xl:mx-0">
				<h1
					class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight text-center xl:text-left"
				>
					Easily find places to spend sats anywhere on the planet.
				</h1>
				<div class="bg-white/30 rounded-2xl py-6 flex flex-wrap justify-center my-16">
					{#each $apps as app}
						<div class="space-y-1 text-body font-semibold text-center my-2 md:my-0 mx-2">
							<p>{app.type}</p>
							<a
								href={app.link}
								target={app.type === 'Web' ? '_self' : '_blank'}
								rel="noreferrer"
								class="block bg-link hover:bg-hover p-3 rounded-full text-white transition-colors"
							>
								<Icon width="32" height="32" icon={app.icon} type="apps" />
							</a>
						</div>
					{/each}
				</div>
				<h2 class="text-primary text-xl font-semibold text-center xl:text-left">
					Our apps and the underlying data are free and open source.
					<br /><br />
					We use OpenStreetMap to properly tag places where you can spend bitcoin and we display that
					data in our beautiful apps.
				</h2>
			</div>
			<img
				src="/images/hero-mobile-example.png"
				alt="mobile example"
				class="drop-shadow-2xl mx-auto xl:mx-0 mt-10 xl:mt-0 w-80"
			/>
		</section>

		<Footer />
	</div>
</div>

<style>
	@media (min-width: 1280px) {
		.street-map {
			background-image: url(/images/street-map.svg);
			background-position: right;
			background-repeat: no-repeat;
			background-size: 65%;
		}
	}
</style>
