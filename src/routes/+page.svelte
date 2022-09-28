<script>
	import { Header, Footer, PrimaryButton } from '$comp';
	import { socials, apps } from '$lib/store';

	const appOptions = [
		{ title: 'APK', link: $apps.direct, icon: 'fa-brands fa-android' },
		{ title: 'F-Droid', link: $apps.fdroid, icon: 'fa-solid fa-robot' },
		{ title: 'Web', link: $apps.web, icon: 'fa-solid fa-earth-americas' }
	];
</script>

<div class="bg-teal street-map">
	<img
		src="/images/street-map.svg"
		alt="roads"
		class="xl:hidden absolute top-0 right-0 2xl:w-[1200px]"
	/>
	<div class="w-10/12 xl:w-[1200px] mx-auto relative">
		<Header />

		<section id="hero" class="pb-20 pt-10 xl:pt-0 xl:flex justify-between items-center">
			<div class="w-full xl:w-[500px] mx-auto xl:mx-0">
				<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight">
					Easily find places to spend sats anywhere on the planet.
				</h1>
				<div class="bg-white/30 rounded-2xl py-6 flex flex-wrap justify-center my-16">
					{#each appOptions as app}
						<div class="space-y-1 text-body font-semibold text-center my-2 md:my-0 mx-2">
							<p>{app.title}</p>
							<a
								href={app.link}
								target={app.title === 'Web' ? '_self' : '_blank'}
								rel="noreferrer"
								class="block"
								><i
									class="bg-link hover:bg-hover p-3 rounded-full w-8 h-8 text-white {app.icon}"
								/></a
							>
						</div>
					{/each}
					<div class="space-y-1 my-2 mx-2 md:my-0 md:mx-0 md:ml-3 md:mr-2">
						<p class="text-body font-semibold text-center">Contribute</p>
						<PrimaryButton
							text="Add Location"
							style="py-3 px-4 rounded-full"
							link="/add-location"
						/>
					</div>
				</div>
				<h2 class="text-primary text-xl font-semibold">
					Our apps and the underlying data are free and open source.
					<br /><br />
					We use OpenStreetMap to properly tag places where you can spend Bitcoin and then we show you
					that data in our beautiful apps.
				</h2>
			</div>
			<img
				src="/images/hero-mobile-example.png"
				alt="mobile example"
				class="drop-shadow-2xl mx-auto xl:mx-0 mt-10 xl:mt-0 w-80"
			/>
		</section>

		<Footer justify="start" />
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
