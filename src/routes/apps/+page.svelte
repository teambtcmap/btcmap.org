<script lang="ts">
	import AppCard from './components/AppCard.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import { apps, theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';

	const communityApps = [
		{
			link: 'https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666',
			type: 'BitLocal',
			icon: 'ios',
			desc: 'iOS'
		}
	];
</script>

<svelte:head>
	<title>BTC Map - Apps</title>
	<meta property="og:image" content="https://btcmap.org/images/og/apps.png" />
	<meta property="twitter:title" content="BTC Map - Apps" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/apps.png" />
</svelte:head>

<main class="my-10 space-y-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-4xl !leading-tight font-semibold text-primary md:text-5xl dark:text-white"
		>
			Find merchants on any platform.
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2 class="mx-auto w-full text-xl font-semibold text-primary lg:w-[800px] dark:text-white">
		We have you covered on whatever device and OS you choose.
	</h2>

	<h3 class="text-2xl font-semibold text-primary md:text-left dark:text-white">Official</h3>
	<section id="official-apps" class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each $apps as app (app.link)}
			<AppCard image={app.icon} text={app.type} desc={app.desc} link={app.link} />
		{/each}
	</section>
	<p class="text-center font-normal dark:text-white">
		Note: There is no Google Play option due to their excessive KYC requirements for developers.
	</p>

	<h3 class="text-2xl font-semibold text-primary md:text-left dark:text-white">Community</h3>
	<section id="community-apps" class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each communityApps as app (app.link)}
			<AppCard image={app.icon} text={app.type} desc={app.desc} link={app.link} />
		{/each}
	</section>
</main>
