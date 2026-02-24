<script lang="ts">
import { _ } from "$lib/i18n";

const brandColors = [
	"#10B981",
	"#53C5D5",
	"#051173",
	"#0891B2",
	"#E4EBEC",
	"#164E63",
	"#155E75",
];

const brand = [
	{
		link: "/images/hero-mobile-example.webp",
		nameKey: "media.assetNames.appScreenshot",
	},
	{ link: "/images/logo.svg", nameKey: "media.assetNames.btcmapLogo" },
	{
		link: "/images/supertagger.svg",
		nameKey: "media.assetNames.shadowySupertagger",
	},
	{
		link: "/images/supertagger-king.svg",
		nameKey: "media.assetNames.shadowySupertaggerLeader",
	},
];

const promotional = [
	{ link: "/images/og/activity.png", nameKey: "media.assetNames.activityFeed" },
	{
		link: "/images/og/add-community.png",
		nameKey: "media.assetNames.addCommunity",
	},
	{ link: "/images/og/add.png", nameKey: "media.assetNames.addLocation" },
	{
		link: "/images/og/communities.png",
		nameKey: "media.assetNames.communities",
	},
	{ link: "/images/og/countries.png", nameKey: "media.assetNames.countries" },
	{ link: "/images/og/apps.png", nameKey: "media.assetNames.downloadApps" },
	{ link: "/images/og/badges.png", nameKey: "media.assetNames.earnBadges" },
	{ link: "/images/og/home.png", nameKey: "media.assetNames.main" },
	{ link: "/images/og/map.png", nameKey: "media.assetNames.map" },
	{ link: "/images/og/merchant.png", nameKey: "media.assetNames.merchant" },
	{ link: "/images/og/dash.png", nameKey: "media.assetNames.statsDashboard" },
	{
		link: "/images/og/leader.png",
		nameKey: "media.assetNames.supertaggerLeaderboard",
	},
	{
		link: "/images/og/supertagger.png",
		nameKey: "media.assetNames.supertaggerProfile",
	},
	{ link: "/images/og/support.png", nameKey: "media.assetNames.supportUs" },
	{
		link: "/images/og/top-communities.png",
		nameKey: "media.assetNames.topCommunities",
	},
	{
		link: "/images/og/top-countries.png",
		nameKey: "media.assetNames.topCountries",
	},
	{
		link: "/images/og/verify.png",
		nameKey: "media.assetNames.verifyLocations",
	},
];

const team = [
	{ link: "/images/team/igor.jpg", nameKey: "media.assetNames.igor" },
	{ link: "/images/team/karnage.jpg", nameKey: "media.assetNames.karnage" },
	{ link: "/images/team/nathan.jpg", nameKey: "media.assetNames.nathanDay" },
	{
		link: "/images/team/secondl1ght.jpg",
		nameKey: "media.assetNames.secondl1ght",
	},
];

const assetSections = [
	{ titleKey: "media.brand", data: brand },
	{ titleKey: "media.promotional", data: promotional },
	{ titleKey: "media.team", data: team },
];
</script>

<svelte:head>
	<title>BTC Map - Media</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - Media" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="mt-10 mb-20 space-y-10 text-center text-primary dark:text-white">
	<div class="space-y-5 text-xl">
		<h1 class="text-4xl !leading-tight font-semibold md:text-5xl">{$_("media.title")}</h1>
		<p>{$_("media.intro")}</p>
	</div>

	<section>
		<h2 class="mb-5 text-3xl font-semibold">{$_("media.brandColors")}</h2>

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
			<h2 class="text-3xl font-semibold">{$_("media.assets")}</h2>

			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/assets/btcmap-media-assets.zip"
				download
				class="mx-auto block w-36 rounded-lg bg-link py-3 font-semibold text-white transition-colors hover:bg-hover"
			>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{$_("media.downloadAll")}
			</a>

			{#each assetSections as section (section.titleKey)}
				<div class="space-y-2 text-left">
					<h3 class="text-xl font-semibold">{$_(section.titleKey)}</h3>

					<ul class="ml-5 list-disc space-y-1">
						{#each section.data as asset (asset.link)}
							<li>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={asset.link} class="text-link transition-colors hover:text-hover">
									{$_(asset.nameKey)}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>
</div>
