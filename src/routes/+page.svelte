<script>
	import { Header, LandingCard, Footer } from '$comp';

	const landingCards = [
		{
			image: 'fdroid',
			text: 'Get our Android app on F-Droid',
			link: 'https://f-droid.org/en/packages/org.btcmap/'
		},
		{ image: 'openlayers', text: 'Join as a contributor', link: 'https://github.com/teambtcmap' },
		{ image: 'web-app', text: 'Web app coming soon!' }
	];
</script>

<div class="bg-teal">
	<img src="/images/street-map.svg" alt="roads" class="absolute top-0 right-0 2xl:w-1/2" />
	<div class="w-10/12 xl:w-[1200px] mx-auto relative">
		<Header />

		<section id="hero" class="pt-10 xl:pt-0 xl:flex justify-center items-center xl:space-x-20">
			<div class="w-full md:w-[700px] xl:w-full mx-auto">
				<h1 class="text-4xl md:text-5xl font-semibold text-heading">
					We're on a mission to enable Bitcoiners to easily <span class="gradient"
						>find places to</span
					> <span class="gradient">spend sats</span> wherever they are on the planet.
				</h1>
				<a
					href="https://wiki.openstreetmap.org/wiki/How_to_contribute"
					target="_blank"
					rel="noreferrer"
					class="my-16 block text-link hover:text-hover text-2xl font-semibold"
					>Add a location <i class="ml-2 fa-solid fa-arrow-right" /></a
				>
				<h2 class="text-primary text-2xl font-semibold">
					Our apps and the underlying data are free and open source.
					<br /><br />
					We use OpenStreetMap to properly tag places where you can spend Bitcoin and then we show you
					that data in our beautiful apps.
				</h2>
			</div>
			<img
				src="/images/hero-mobile-example.png"
				alt="mobile example"
				class="mx-auto mt-10 xl:mt-0"
			/>
		</section>

		<section id="cards" class="pb-10 pt-10 md:pb-20 flex xl:block justify-center">
			<div
				class="lg:flex flex-wrap justify-center items-center lg:space-x-10 xl:space-x-0 xl:grid grid-cols-3 gap-5"
			>
				{#each landingCards as card}
					<LandingCard image={card.image} text={card.text} link={card.link} />
				{/each}
			</div>
		</section>

		<Footer />
	</div>
</div>

<style>
	.gradient {
		background: -webkit-linear-gradient(45deg, #0ecd71, #040273);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
</style>
