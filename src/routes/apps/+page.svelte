<script>
	import { Header, Footer, AppCard } from '$comp';
	import { apps } from '$lib/store';
</script>

<div class="bg-teal">
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<Header />

		<main class="text-center space-y-10 my-10 md:my-20">
			<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight">
				Find merchants on any platform.
			</h1>

			<h2 class="text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				We have you covered on whatever device and OS you choose.
			</h2>

			<section id="apps" class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
				<AppCard
					image="fa-brands fa-android"
					text="APK"
					desc="Direct Download"
					link={$apps.direct}
				/>
				<AppCard
					image="fa-solid fa-robot"
					text="F-Droid"
					desc="FOSS App Store"
					link={$apps.fdroid}
				/>
				<AppCard
					image="fa-solid fa-earth-americas"
					text="Web"
					desc="Progressive Web App"
					link={$apps.web}
				/>
				<AppCard image="fa-brands fa-app-store-ios" text="iOS" link="" desc="" />
				<AppCard image="fa-brands fa-google-play" text="Play" link="" desc="" />
			</section>
		</main>

		<Footer justify="center" />
	</div>
</div>
