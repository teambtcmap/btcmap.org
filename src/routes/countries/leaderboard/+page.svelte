<script lang="ts">
	import AreaLeaderboard from '$lib/components/leaderboard/AreaLeaderboard.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import HeaderPlaceholder from '$lib/components/HeaderPlaceholder.svelte';
	import PrimaryButton from '$lib/components/PrimaryButton.svelte';
	import { theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';

	const routes = [
		{ name: 'Countries', url: '/countries' },
		{ name: 'Leaderboard', url: '/countries/leaderboard' }
	];
</script>

<svelte:head>
	<title>BTC Map - Countries Leaderboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/top-countries.png" />
	<meta property="twitter:title" content="BTC Map - Countries Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/top-countries.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<Breadcrumbs {routes} />

	<main class="mt-10">
		<div class="mx-auto w-10/12 space-y-10 xl:w-[1200px]">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl"
				>
					Top Countries
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2
				class="mx-auto w-full text-center text-xl font-semibold text-primary lg:w-[800px] dark:text-white"
			>
				Insights into bitcoin adoption worldwide!
			</h2>

			<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl" link="/countries">
				View directory
			</PrimaryButton>

			<AreaLeaderboard type="country" />

			<Footer />
		</div>
	</main>
</div>
