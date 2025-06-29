<script lang="ts">
	import {
		AreaLeaderboard,
		Breadcrumbs,
		Footer,
		Header,
		HeaderPlaceholder,
		PrimaryButton
	} from '$lib/comp';

	import { theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';

	const routes = [
		{ name: 'Communities', url: '/communities' },
		{ name: 'Leaderboard', url: '/communities/leaderboard' }
	];
</script>

<svelte:head>
	<title>BTC Map - Communities Leaderboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/top-communities.png" />
	<meta property="twitter:title" content="BTC Map - Communities Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/top-communities.png" />
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
						: 'gradient'} text-center text-4xl font-semibold !leading-tight md:text-5xl"
				>
					Top Communities
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2
				class="mx-auto w-full text-center text-xl font-semibold text-primary dark:text-white lg:w-[800px]"
			>
				Bitcoin mapping communities maintain their local datasets and strive to have the most
				accurate information. They also help onboard new merchants in their area!
			</h2>

			<div>
				<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl mb-5" link="/communities">
					Directory
				</PrimaryButton>

				<div class="items-center justify-center space-y-5 md:flex md:space-x-5 md:space-y-0">
					<PrimaryButton
						style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
						link="/communities/add"
					>
						Add community
					</PrimaryButton>
					<PrimaryButton
						style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
						link="/communities/map"
					>
						View community map
					</PrimaryButton>
				</div>
			</div>

			<AreaLeaderboard type="community" />

			<Footer />
		</div>
	</main>
</div>
