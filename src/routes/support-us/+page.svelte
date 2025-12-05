<script lang="ts">
	import CloseButton from '$components/CloseButton.svelte';
	import DonationOption from './components/DonationOption.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import SupportSection from './components/SupportSection.svelte';
	import { BREAKPOINTS } from '$lib/constants';
	import { theme } from '$lib/store';
	import type { DonationType } from '$lib/types';
	import { detectTheme, warningToast } from '$lib/utils';
	import QRCode from 'qrcode';
	import type { Action } from 'svelte/action';

	const onchain = 'bc1qt4g28vq480ec4ncl4h67qu4q4k2zel7xu0c2wg';
	const lnurlp = 'LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34';

	let showQr = false;
	let network: DonationType;

	const showQrToggle = (type: DonationType) => {
		network = type;
		showQr = true;
	};

	const renderQr: Action<HTMLCanvasElement> = (node) => {
		QRCode.toCanvas(
			node,
			network === 'Lightning' ? 'lightning:' + lnurlp : 'bitcoin:' + onchain,
			{ width: window.innerWidth > BREAKPOINTS.sm ? 256 : 200 },
			function (error: Error | null | undefined) {
				if (error) {
					warningToast('Could not generate QR, please try again or contact BTC Map.');
					console.error(error);
				}
			}
		);
	};

	const supporters = [
		{ url: 'https://coinos.io/', title: 'coinos', logo: 'coinos.svg', logoDark: 'coinos-dark.svg' },
		{ url: 'https://www.walletofsatoshi.com/', title: 'Wallet of Satoshi', logo: 'wos.png' },
		{ url: 'https://btccuracao.com/', title: 'BTC Curacao', logo: 'btccuracao.png' },
		{ url: 'https://geyser.fund/project/satsnfacts', title: 'Sats n Facts', logo: 'satsnfacts.png' }
	];
</script>

<svelte:head>
	<title>BTC Map - Support Us</title>
	<meta property="og:image" content="https://btcmap.org/images/og/support.png" />
	<meta property="twitter:title" content="BTC Map - Support Us" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/support.png" />
</svelte:head>

<main class="my-10 space-y-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-4xl !leading-tight font-semibold md:text-5xl"
		>
			Help place bitcoin on the map.
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2 class="mx-auto w-full text-xl font-semibold text-primary lg:w-[800px] dark:text-white">
		BTCMap.org is a free and open source project (FOSS). We rely on donations and sponsorship to
		continue.

		<br /><br />
		We greatly appreciate all support.
	</h2>

	<section id="donate">
		{#if showQr}
			<div
				class="relative mx-auto flex h-[450px] w-full items-center justify-center rounded-xl bg-slate-100 drop-shadow-xl md:h-[380px] md:w-[475px] dark:bg-white/[0.15]"
			>
				<div class="space-y-5">
					<CloseButton
						position="absolute top-4 right-6"
						colors="text-link hover:text-hover"
						on:click={() => (showQr = false)}
					/>

					<!-- qr -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={network === 'Lightning' ? `lightning:${lnurlp}` : `bitcoin:${onchain}`}>
						<canvas
							use:renderQr
							class="mx-auto h-[200px] w-[200px] rounded-xl border-4 border-link transition-colors hover:border-hover sm:h-[256px] sm:w-[256px]"
						/>
					</a>

					<!-- cta -->
					<p class="text-center text-xl text-primary dark:text-white">
						Scan or click to donate <br class="block md:hidden" /><strong class="lowercase"
							>{network}</strong
						>
						<img
							src={network === 'Lightning' ? '/icons/ln-highlight.svg' : '/icons/btc-highlight.svg'}
							alt="protocol"
							class="mb-1 inline dark:rounded-full dark:bg-white dark:p-0.5"
						/>
					</p>
				</div>
			</div>
		{:else}
			<div class="space-y-5">
				<!-- onchain -->
				<DonationOption value={onchain} text="On-chain" {showQrToggle} />
				<!-- lightning -->
				<DonationOption value={lnurlp} text="Lightning" {showQrToggle} />
			</div>
		{/if}
	</section>

	<section id="supporters">
		<h2 class="text-xl font-semibold text-primary uppercase dark:text-white">
			Our amazing supporters
		</h2>
		<a href="mailto:hello@btcmap.org" class="text-link transition-colors hover:text-hover"
			>Become a Sponsor</a
		>

		<SupportSection {supporters} placeholders={2} />
	</section>

	<section id="node">
		<!-- channel -->
		<div>
			<h3 class="text-lg font-semibold text-body uppercase dark:text-white">
				Open a lightning channel to us
			</h3>
			<a
				href="https://amboss.space/node/03ef01535d57cd3a3ddff8b4050650b278991b3eb7853f772a200079b9adb24988"
				target="_blank"
				rel="noreferrer"
				class="break-all text-link transition-colors hover:text-hover"
				>03ef01535d57cd3a3ddff8b4050650b278991b3eb7853f772a200079b9adb24988</a
			>
		</div>
	</section>
</main>
