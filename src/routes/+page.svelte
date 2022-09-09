<script>
	import { Header, LandingCard, Footer, PrimaryButton } from '$comp';
	import { socials, fdroid } from '$lib/store';

	const landingCards = [
		{
			image: 'fdroid',
			text: 'Get our Android app on F-Droid',
			link: $fdroid
		},
		{ image: 'openlayers', text: 'Join as a contributor', link: $socials.discord },
		{ image: 'web-app', text: 'Web app coming soon!' }
	];
</script>

<div class="bg-teal">
	<img src="/images/street-map.svg" alt="roads" class="absolute top-0 right-0 2xl:w-[1200px]" />
	<div class="w-10/12 xl:w-[1200px] mx-auto relative">
		<Header />

		<section id="hero" class="pb-20 pt-10 xl:pt-0 xl:flex justify-between items-center">
			<div class="w-full xl:w-[500px] mx-auto xl:mx-0">
				<h1 class="text-4xl md:text-5xl font-semibold text-heading gradient">
					Easily find places to spend sats anywhere on the planet.
				</h1>
				<PrimaryButton
					text="Add a location"
					link="https://github.com/teambtcmap/btcmap.org/wiki/Tagging-Instructions"
					style="my-16 w-52"
				/>
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
				class="drop-shadow-2xl mx-auto xl:mx-0 mt-10 xl:mt-0 w-96"
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
