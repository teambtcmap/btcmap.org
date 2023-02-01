<script>
	import axios from 'axios';
	import { onMount } from 'svelte';
	import { Header, Footer, DonationOption, SupportSection, Icon, CloseButton } from '$comp';
	import { errToast } from '$lib/utils';

	let onchain = 'bc1qyyr7g9tew6sfa57mv2r6rvgj2ucakcmqnqzqjj';
	const lnurlp =
		'LNURL1DP68GURN8GHJ7ERZXVUXVER9X4SNYTNY9EMX7MR5V9NK2CTSWQHXJME0D3H82UNVWQHKZURF9AMRZTMVDE6HYMP0XYA8GEF9';

	let showQr = false;
	let network;

	const showQrToggle = (type) => {
		network = type;
		showQr = true;
	};

	const company = [
		{ url: 'https://coinos.io/', title: 'coinos', logo: 'coinos.svg' },
		{ url: 'https://www.walletofsatoshi.com/', title: 'Wallet of Satoshi', logo: 'wos.svg' },
		{ url: 'https://swiss-bitcoin-pay.ch/', title: 'Swiss Bitcoin Pay', logo: 'swiss.svg' }
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

<div class="bg-teal">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 space-y-10 text-center md:my-20">
			<h1 class="gradient text-4xl font-semibold !leading-tight text-primary md:text-5xl">
				Help place bitcoin on the map.
			</h1>

			<h2 class="mx-auto w-full text-xl font-semibold text-primary lg:w-[800px]">
				BTCMap.org is a free and open source project (FOSS). We rely on donations and sponsorship to
				continue.

				<br /><br />
				We greatly appreciate all support.
			</h2>

			<section id="donate">
				{#if showQr}
					<div
						class="relative mx-auto flex h-[450px] w-full items-center justify-center rounded-xl bg-lightBlue drop-shadow-xl md:h-[380px] md:w-[475px]"
					>
						<div class="space-y-5">
							<CloseButton
								position="absolute top-4 right-6"
								click={() => (showQr = false)}
								colors="text-link hover:text-hover"
							/>

							<!-- qr -->
							<a href={network === 'Lightning' ? `lightning:${lnurlp}` : `bitcoin:${onchain}`}>
								<img
									src={network === 'Lightning'
										? '/images/lightning-qr.svg'
										: '/images/onchain-qr.svg'}
									alt="qr"
									class="mx-auto h-[256px] w-[256px] rounded-xl border-4 border-link transition-colors hover:border-hover"
								/>
							</a>

							<!-- cta -->
							<p class="text-center text-xl text-primary">
								Scan or click to donate <br class="block md:hidden" /><strong class="lowercase"
									>{network}</strong
								>
								<img
									src={network === 'Lightning'
										? '/icons/ln-highlight.svg'
										: '/icons/btc-highlight.svg'}
									alt="protocol"
									class="mb-1 inline"
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
				<h2 class="text-xl font-semibold uppercase text-primary">Our amazing supporters</h2>
				<a href="mailto:hello@btcmap.org" class="text-link transition-colors hover:text-hover"
					>Become a Sponsor</a
				>

				<div class="mt-4 space-y-16">
					<SupportSection title="Company" supporters={company} placeholders={0} />
					<SupportSection title="Community" supporters={community} placeholders={1} />
				</div>
			</section>

			<section id="node">
				<!-- channel -->
				<div>
					<h3 class="text-lg font-semibold uppercase text-body">Open a lightning channel to us</h3>
					<a
						href="https://amboss.space/node/02eb5a2e05ef32d0434ea616d38a1a46deaf9f246dc418673f43a571bba0363031"
						target="_blank"
						rel="noreferrer"
						class="break-all text-link transition-colors hover:text-hover"
						>02eb5a2e05ef32d0434ea616d38a1a46deaf9f246dc418673f43a571bba0363031</a
					>
					<iframe
						src="https://amboss.space/embed/node/info/02eb5a2e05ef32d0434ea616d38a1a46deaf9f246dc418673f43a571bba0363031?theme=light&noBackground=true"
						width="100%"
						class="h-[300px] xl:h-[271.5px]"
					/>
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>
