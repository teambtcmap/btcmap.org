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
		{ url: 'https://www.walletofsatoshi.com/', title: 'Wallet of Satoshi', logo: 'wos.svg' }
	];

	const community = [
		{ url: 'https://btccuracao.com/', title: 'BTC Curacao', logo: 'btccuracao.png' },
		{
			url: 'https://pouch.ph/bitcoinisland',
			title: 'Bitcoin Island Philippines',
			logo: 'bitcoin-island-philippines.jpeg'
		}
	];

	/* onMount(() => {
		axios
			.get('/support-us/endpoint')
			.then(function (response) {
				console.log(response);
			})
			.catch(function (error) {
				errToast('Could not fetch new on-chain address, please use lightning.');
				console.log(error);
			});
	}); */
</script>

<svelte:head>
	<title>BTC Map - Support Us</title>
	<meta property="og:image" content="https://btcmap.org/images/og/support.png" />
	<meta property="twitter:title" content="BTC Map - Support Us" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/support.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center space-y-10 my-10 md:my-20">
			<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight">
				Help place bitcoin on the map.
			</h1>

			<h2 class="text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				BTCMap.org is a free and open source project (FOSS). We rely on donations and sponsorship to
				continue.

				<br /><br />
				We greatly appreciate all support.
			</h2>

			<section id="donate" class="space-y-10">
				{#if showQr}
					<div
						class="drop-shadow-xl relative bg-lightBlue rounded-xl w-full md:w-[475px] h-[450px] md:h-[380px] flex justify-center items-center mx-auto"
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
									class="w-[256px] h-[256px] mx-auto border-4 rounded-xl border-link hover:border-hover transition-colors"
								/>
							</a>

							<!-- cta -->
							<p class="text-primary text-xl text-center">
								Scan or click to donate <br class="block md:hidden" /><strong class="lowercase"
									>{network}</strong
								>
								<img
									src={network === 'Lightning'
										? '/icons/ln-highlight.svg'
										: '/icons/btc-highlight.svg'}
									alt="protocol"
									class="inline mb-1"
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
				<!-- channel -->
				<div>
					<h3 class="uppercase text-body text-lg font-semibold">Open a lightning channel to us</h3>
					<a
						href="https://mempool.space/lightning/node/02eb5a2e05ef32d0434ea616d38a1a46deaf9f246dc418673f43a571bba0363031"
						target="_blank"
						rel="noreferrer"
						class="text-link hover:text-hover break-all transition-colors"
						>02eb5a2e05ef32d0434ea616d38a1a46deaf9f246dc418673f43a571bba0363031</a
					>
				</div>
			</section>

			<section id="supporters">
				<h2 class="uppercase text-primary text-xl font-semibold">Our amazing supporters</h2>
				<a href="mailto:hello@btcmap.org" class="text-link hover:text-hover transition-colors"
					>Become a Sponsor</a
				>

				<div class="mt-4 space-y-16">
					<SupportSection title="Company" supporters={company} placeholders={1} />
					<SupportSection title="Community" supporters={community} placeholders={1} />
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>
