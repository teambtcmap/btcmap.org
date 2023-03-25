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

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 space-y-10 text-center md:my-20">
			<h1
				class="gradient text-4xl font-semibold !leading-tight text-primary dark:text-white md:text-5xl"
			>
				Find merchants on any platform.
			</h1>

			<h2 class="mx-auto w-full text-xl font-semibold text-primary dark:text-white lg:w-[800px]">
				We have you covered on whatever device and OS you choose.
			</h2>

			<section id="apps" class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each $apps as app}
					<AppCard image={app.icon} text={app.type} desc={app.desc} link={app.link} />
				{/each}
			</section>
		</main>

		<Footer />
	</div>
</div>
