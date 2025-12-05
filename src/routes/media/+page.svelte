<script lang="ts">
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
		{ link: '/images/og/countries.png', name: 'Countries' },
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
		{ link: '/images/og/top-countries.png', name: 'Top Countries' },
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

<main class="mt-10 mb-20 space-y-10 text-center text-primary dark:text-white">
	<div class="space-y-5 text-xl">
		<h1 class="text-4xl !leading-tight font-semibold md:text-5xl">Media</h1>
		<p>Media assets are available for free to use for promotional purposes.</p>
	</div>

	<section>
		<h2 class="mb-5 text-3xl font-semibold">Brand Colors</h2>

		<div class="flex flex-wrap justify-center gap-5">
			{#each brandColors as color (color)}
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

			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/assets/btcmap-media-assets.zip"
				download
				class="mx-auto block w-36 rounded-lg bg-link py-3 font-semibold text-white transition-colors hover:bg-hover"
			>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				Download All
			</a>

			{#each assetSections as section (section.title)}
				<div class="space-y-2 text-left">
					<h3 class="text-xl font-semibold">{section.title}</h3>

					<ul class="ml-5 list-disc space-y-1">
						{#each section.data as asset (asset.name)}
							<li>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={asset.link} class="text-link transition-colors hover:text-hover">
									{asset.name}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>
</main>
