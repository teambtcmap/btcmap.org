<script lang="ts">
import type { Action } from "svelte/action";

import CloseButton from "$components/CloseButton.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import { BREAKPOINTS, QR_CODE_SIZE } from "$lib/constants";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";
import type { DonationType } from "$lib/types";
import { warningToast } from "$lib/utils";

import DonationOption from "./components/DonationOption.svelte";
import SupportSection from "./components/SupportSection.svelte";

const onchain = "bc1qt4g28vq480ec4ncl4h67qu4q4k2zel7xu0c2wg";
const lnurlp =
	"LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34";

let showQr = false;
$: t = $_;
let network: DonationType;

const showQrToggle = (type: DonationType) => {
	network = type;
	showQr = true;
};

const renderQr: Action<HTMLCanvasElement> = (node) => {
	import("qrcode")
		.then((QRCode) => {
			QRCode.default.toCanvas(
				node,
				network === "Lightning" ? `lightning:${lnurlp}` : `bitcoin:${onchain}`,
				{
					width:
						window.innerWidth > BREAKPOINTS.md
							? QR_CODE_SIZE.desktop
							: QR_CODE_SIZE.mobile,
				},
				(error: Error | null | undefined) => {
					if (error) {
						warningToast(t("supportUs.qrError"));
						console.error(error);
					}
				},
			);
		})
		.catch((error) => {
			warningToast(t("supportUs.qrLoadError"));
			console.error("Failed to load QRCode module:", error);
		});
};

const supporters = [
	{
		url: "https://coinos.io/",
		title: "coinos",
		logo: "coinos.svg",
		logoDark: "coinos-dark.svg",
	},
	{
		url: "https://www.walletofsatoshi.com/",
		title: "Wallet of Satoshi",
		logo: "wos.png",
	},
	{
		url: "https://btccuracao.com/",
		title: "BTC Curacao",
		logo: "btccuracao.png",
	},
	{
		url: "https://geyser.fund/project/satsnfacts",
		title: "Sats n Facts",
		logo: "satsnfacts.png",
	},
];
</script>

<svelte:head>
	<title>BTC Map - {$_("supportUs.title")}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/support.png" />
	<meta property="twitter:title" content="BTC Map - {$_("supportUs.title")}" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/support.png" />
</svelte:head>

<div class="my-10 space-y-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-4xl !leading-tight font-semibold md:text-5xl"
		>
			{t("supportUs.hero")}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2 class="mx-auto w-full text-xl font-semibold text-primary lg:w-[800px] dark:text-white">
		{t("supportUs.intro")}

		<br /><br />
		{t("supportUs.appreciate")}
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
						{t("supportUs.donate.scanOrClick")} <br class="block md:hidden" /><strong class="lowercase"
							>{network === 'Lightning' ? t("supportUs.donate.lightning") : t("supportUs.donate.onchain")}</strong
						>
						<img
							src={network === 'Lightning' ? '/icons/ln-highlight.svg' : '/icons/btc-highlight.svg'}
							alt={`${t(network === 'Lightning' ? "supportUs.donate.lightning" : "supportUs.donate.onchain")} ${t("supportUs.donate.protocolAlt")}`}
							class="mb-1 inline dark:rounded-full dark:bg-white dark:p-0.5"
						/>
					</p>
				</div>
			</div>
		{:else}
			<div class="space-y-5">
				<!-- onchain -->
				<DonationOption value={onchain} textKey="supportUs.donate.onchain" network="On-chain" {showQrToggle} />
				<!-- lightning -->
				<DonationOption value={lnurlp} textKey="supportUs.donate.lightning" network="Lightning" {showQrToggle} />
			</div>
		{/if}
	</section>

	<section id="supporters">
		<h2 class="text-xl font-semibold text-primary uppercase dark:text-white">
			{t("supportUs.supporters.heading")}
		</h2>
		<a href="mailto:hello@btcmap.org" class="text-link transition-colors hover:text-hover"
			>{t("supportUs.supporters.becomeSponsor")}</a
		>

		<SupportSection {supporters} placeholders={2} />
	</section>

	<section id="node">
		<!-- channel -->
		<div>
			<h3 class="text-lg font-semibold text-body uppercase dark:text-white">
				{t("supportUs.node.heading")}
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
</div>
