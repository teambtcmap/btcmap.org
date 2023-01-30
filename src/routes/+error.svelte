<script>
	import { page } from '$app/stores';
	import { SocialLink } from '$comp';
	import { socials } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
	{#if $page.url.pathname.startsWith('/tagger') || $page.url.pathname.startsWith('/community')}
		<meta
			name="lightning"
			content="lnurlp:LNURL1DP68GURN8GHJ7ERZXVUXVER9X4SNYTNY9EMX7MR5V9NK2CTSWQHXJME0D3H82UNVWQHKZURF9AMRZTMVDE6HYMP0XYA8GEF9"
		/>
		<meta property="alby:image" content="/images/logo.svg" />
		<meta property="alby:name" content="BTC Map" />
	{/if}
</svelte:head>

<div class="bg-teal">
	<div class="relative mx-auto w-10/12 xl:w-[1200px]">
		<header>
			<a href="/">
				<img src="/images/logo.svg" alt="logo" class="mx-auto w-32 py-5" />
			</a>
		</header>

		<div class="space-y-10 py-10 text-center">
			<a href="/" class="text-xl font-semibold text-link transition-colors hover:text-hover"
				><i class="fa-solid fa-house mr-2" /> Home</a
			>
			<h1 class="text-4xl md:text-5xl">{$page.status}: {$page.error.message}</h1>
			<h2 class="text-xl font-semibold text-primary">Please try again or contact BTC Map.</h2>
		</div>

		<footer class="flex justify-center space-x-5 pb-5">
			<SocialLink url={$socials.twitter} social="twitter" />
			<SocialLink url={$socials.discord} social="discord" />
			<SocialLink url={$socials.github} social="github" />
		</footer>
	</div>
</div>
