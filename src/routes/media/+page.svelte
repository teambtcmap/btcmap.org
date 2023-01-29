<script>
	import { Header, Footer } from '$comp';

	const brandColors = ['#10B981', '#53C5D5', '#051173', '#0891B2', '#E4EBEC', '#164E63', '#155E75'];

	const brand = [
		{ link: '/images/hero-mobile-example.png', name: 'App Screenshot' },
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

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center space-y-10 mt-10 mb-20 text-primary">
			<div class="text-xl space-y-5">
				<h1 class="text-4xl md:text-5xl font-semibold !leading-tight">Media</h1>
				<p>Media assets are available for free to use for promotional purposes.</p>
			</div>

			<section>
				<h2 class="text-3xl font-semibold mb-5">Brand Colors</h2>

				<div class="flex flex-wrap justify-center gap-5">
					{#each brandColors as color}
						<div
							class="w-24 h-24 flex justify-center items-center"
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
						class="block text-white font-semibold bg-link hover:bg-hover w-36 mx-auto py-3 rounded-lg transition-colors"
						>Download All</a
					>

					{#each assetSections as section}
						<div class="text-left space-y-2">
							<h3 class="text-xl font-semibold">{section.title}</h3>

							<ul class="list-disc ml-5 space-y-1">
								{#each section.data as asset}
									<li>
										<a href={asset.link} class="text-link hover:text-hover transition-colors"
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
