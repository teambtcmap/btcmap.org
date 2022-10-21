<script>
	import { Header, Footer, AppCard } from '$comp';
	import { apps } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map - Apps</title>
	<meta property="og:image" content="https://btcmap.org/images/og/apps.png" />
	<meta property="twitter:title" content="BTC Map - Apps" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/apps.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center space-y-10 my-10 md:my-20">
			<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight">
				Find merchants on any platform.
			</h1>

			<h2 class="text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				We have you covered on whatever device and OS you choose.
			</h2>

			<section id="apps" class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
				<AppCard
					image="fa-solid fa-earth-americas"
					text="Web"
					desc="Progressive Web App"
					link={$apps.web}
				/>
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
					image="fa-brands fa-google-play"
					text="Play"
					link={$apps.play}
					desc="Not Recommended"
				/>
				<AppCard image="fa-brands fa-app-store-ios" text="iOS" link="" desc="" />
			</section>
		</main>

		<Footer />
	</div>
</div>
