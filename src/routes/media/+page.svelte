<script lang="ts">
	import { Footer, Header } from '$lib/comp';

	const brandColors = ['#10B981', '#53C5D5', '#051173', '#0891B2', '#E4EBEC', '#164E63', '#155E75'];

	const brand = [
		{ link: '/images/hero-mobile-example.webp', name: 'App Screenshot' },
		{ link: '/images/logo.svg', name: 'BTC Map Logo' },
		{ link: '/images/supertagger.svg', name: 'Shadowy Supertagger' },
		{ link: '/images/supertagger-king.svg', name: 'Shadowy Supertagger - Leader' }
	];

	const promotional = [
		{ link: '/images/og/activity.png', name: 'Activity Feed' },
		{ link: '/images/og/add-community.png', name: 'Add Community' },
		{ link: '/images/og/add.png', name: 'Add Location' },
		{ link: '/images/og/communities.png', name: 'Communities' },
		{ link: '/images/og/apps.png', name: 'Download Apps' },
		{ link: '/images/og/badges.png', name: 'Earn Badges' },
		{ link: '/images/og/home.png', name: 'Main' },
		{ link: '/images/og/map.png', name: 'Map' },
		{ link: '/images/og/merchant.png', name: 'Merchant' },
		{ link: '/images/og/dash.png', name: 'Stats Dashboard' },
		{ link: '/images/og/leader.png', name: 'Supertagger Leaderboard' },
		{ link: '/images/og/supertagger.png', name: 'Supertagger Profile' },
		{ link: '/images/og/support.png', name: 'Support Us' },
		{ link: '/images/og/top-communities.png', name: 'Top Communities' },
		{ link: '/images/og/verify.png', name: 'Verify Locations' }
	];

	const team = [
		{ link: '/images/team/igor.jpg', name: 'Igor' },
		{ link: '/images/team/karnage.jpg', name: 'Karnage' },
		{ link: '/images/team/nathan.jpg', name: 'Nathan Day' },
		{ link: '/images/team/secondl1ght.jpg', name: 'secondl1ght' }
	];

	const assetSections = [
		{ title: 'Brand', data: brand },
		{ title: 'Promotional', data: promotional },
		{ title: 'Team', data: team }
	];
</script>

<svelte:head>
	<title>BTC Map - Media</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - Media" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="mb-20 mt-10 space-y-10 text-center text-primary dark:text-white">
			<div class="space-y-5 text-xl">
				<h1 class="text-4xl font-semibold !leading-tight md:text-5xl">Media</h1>
				<p>Media assets are available for free to use for promotional purposes.</p>
			</div>

			<section>
				<h2 class="mb-5 text-3xl font-semibold">Brand Colors</h2>

				<div class="flex flex-wrap justify-center gap-5">
					{#each brandColors as color}
						<div
							class="flex h-24 w-24 items-center justify-center"
							style="background-color: {color}; border: 1px solid black;"
						>
							<p class="text-black">{color}</p>
						</div>
					{/each}
				</div>
			</section>

			<section class="flex justify-center">
				<div class="space-y-5">
					<h2 class="text-3xl font-semibold">Assets</h2>

					<a
						href="/assets/btcmap-media-assets.zip"
						download
						class="mx-auto block w-36 rounded-lg bg-link py-3 font-semibold text-white transition-colors hover:bg-hover"
						>Download All</a
					>

					{#each assetSections as section}
						<div class="space-y-2 text-left">
							<h3 class="text-xl font-semibold">{section.title}</h3>

							<ul class="ml-5 list-disc space-y-1">
								{#each section.data as asset}
									<li>
										<a href={asset.link} class="text-link transition-colors hover:text-hover"
											>{asset.name}</a
										>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</section>
		</main>
		<Footer />
	</div>
</div>
