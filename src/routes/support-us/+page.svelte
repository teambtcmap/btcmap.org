<script lang="ts">
	import {
		CloseButton,
		DonationOption,
		Footer,
		Header,
		HeaderPlaceholder,
		SupportSection
	} from '$lib/comp';
	import { theme } from '$lib/store';
	import type { DonationType } from '$lib/types';
	import { detectTheme, warningToast } from '$lib/utils';
	import QRCode from 'qrcode';
	import type { Action } from 'svelte/action';
	import type { PageData } from './$types';

	export let data: PageData;

	let onchain = data.address;
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
			{ width: window.innerWidth > 640 ? 256 : 200 },
			function (error: any) {
				if (error) {
					warningToast('Could not generate QR, please try again or contact BTC Map.');
					console.error(error);
				}
			}
		);
	};

	const company = [
		{ url: 'https://coinos.io/', title: 'coinos', logo: 'coinos.svg', logoDark: 'coinos-dark.svg' },
		{ url: 'https://www.walletofsatoshi.com/', title: 'Wallet of Satoshi', logo: 'wos.png' }
	];

	const community = [
		{ url: 'https://btccuracao.com/', title: 'BTC Curacao', logo: 'btccuracao.png' },
		{
			url: 'https://pouch.ph/bitcoinisland',
			title: 'Bitcoin Island Philippines',
			logo: 'bitcoin-island-philippines.jpeg'
		}
	];
</script>

<svelte:head>
	<title>BTC Map - Support Us</title>
	<meta property="og:image" content="https://btcmap.org/images/og/support.png" />
	<meta property="twitter:title" content="BTC Map - Support Us" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/support.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 space-y-10 text-center md:my-20">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-4xl font-semibold !leading-tight md:text-5xl"
				>
					Help place bitcoin on the map.
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2 class="mx-auto w-full text-xl font-semibold text-primary dark:text-white lg:w-[800px]">
				BTCMap.org is a free and open source project (FOSS). We rely on donations and sponsorship to
				continue.

				<br /><br />
				We greatly appreciate all support.
			</h2>

			<section id="donate">
				{#if showQr}
					<div
						class="relative mx-auto flex h-[450px] w-full items-center justify-center rounded-xl bg-lightBlue drop-shadow-xl dark:bg-white/[0.15] md:h-[380px] md:w-[475px]"
					>
						<div class="space-y-5">
							<CloseButton
								position="absolute top-4 right-6"
								click={() => (showQr = false)}
								colors="text-link hover:text-hover"
							/>

							<!-- qr -->
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
									src={network === 'Lightning'
										? '/icons/ln-highlight.svg'
										: '/icons/btc-highlight.svg'}
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
				<h2 class="text-xl font-semibold uppercase text-primary dark:text-white">
					Our amazing supporters
				</h2>
				<a href="mailto:hello@btcmap.org" class="text-link transition-colors hover:text-hover"
					>Become a Sponsor</a
				>

				<div class="mt-4 space-y-16">
					<SupportSection title="Company" supporters={company} placeholders={1} />
					<SupportSection title="Community" supporters={community} placeholders={1} />
				</div>
			</section>

			<section id="node">
				<!-- channel -->
				<div>
					<h3 class="text-lg font-semibold uppercase text-body dark:text-white">
						Open a lightning channel to us
					</h3>
					<a
						href="https://amboss.space/node/03ef01535d57cd3a3ddff8b4050650b278991b3eb7853f772a200079b9adb24988"
						target="_blank"
						rel="noreferrer"
						class="break-all text-link transition-colors hover:text-hover"
						>03ef01535d57cd3a3ddff8b4050650b278991b3eb7853f772a200079b9adb24988</a
					>
					{#if typeof window !== 'undefined'}
						<iframe
							title="Amboss Stats"
							src="https://amboss.space/embed/node/info/03ef01535d57cd3a3ddff8b4050650b278991b3eb7853f772a200079b9adb24988?theme={detectTheme() ===
								'dark' || $theme === 'dark'
								? 'dark'
								: 'light'}&noBackground=true"
							width="100%"
							class="h-[648px] md:h-[588px] lg:h-[271.5px]"
						/>
					{/if}
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>
