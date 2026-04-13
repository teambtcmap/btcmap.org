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
import PlebSection from "./components/PlebSection.svelte";
import SupportSection from "./components/SupportSection.svelte";
import type { SponsorshipLevel } from "./sponsors";
import { plebs, sponsors, sponsorshipTiers } from "./sponsors";

const PLEB_TIER_CTA = "https://geyser.fund/project/btcmap/rewards";

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
						warningToast(t("supporters.qrError"));
						console.error(error);
					}
				},
			);
		})
		.catch((error) => {
			warningToast(t("supporters.qrLoadError"));
			console.error("Failed to load QRCode module:", error);
		});
};

type SponsorsByLevel = Record<SponsorshipLevel, typeof sponsors>;

const sponsorsByLevel = sponsorshipTiers.reduce<SponsorsByLevel>(
	(acc, tier) => {
		acc[tier.level] = sponsors.filter(
			(sponsor) => sponsor.level === tier.level,
		);
		return acc;
	},
	{
		Explorer: [],
		Wayfinder: [],
		Cartographer: [],
		Navigator: [],
		Pioneer: [],
		Pleb: [],
	},
);

const orgTiers = [...sponsorshipTiers]
	.filter((t) => t.level !== "Pleb")
	.reverse();

const plebTier = sponsorshipTiers.find((t) => t.level === "Pleb")!;
</script>

<svelte:head>
	<title>BTC Map - {t("supporters.title")}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/support.png" />
	<meta name="twitter:title" content="BTC Map - {t("supporters.title")}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/support.png" />
</svelte:head>

<div class="my-10 space-y-10 text-center md:my-20">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-4xl !leading-tight font-semibold md:text-5xl"
		>
			{t("supporters.hero")}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<!-- Pleb tier -->
	<section id="pleb-supporters" class="space-y-6">
		<div class="mx-auto max-w-2xl space-y-4">
			<h2 class="text-3xl font-bold text-primary dark:text-white">Individual Supporters</h2>
			<p class="text-base text-body dark:text-slate-300">
				BTC Map is community-powered. Individual supporters are the foundation of everything we build —
				keeping the project independent, open, and in the hands of the people who use it.
			</p>
			<a
				href={PLEB_TIER_CTA}
				target="_blank"
				rel="noreferrer"
				class="inline-block rounded-xl bg-link px-6 py-3 font-semibold text-white transition-colors hover:bg-hover"
			>
				Become a Supporter
			</a>
		</div>

		<PlebSection tier={plebTier} {plebs} ctaHref={PLEB_TIER_CTA} />
	</section>

	<!-- Industry sponsors -->
	<section id="sponsors" class="space-y-6">
		<div class="mx-auto max-w-2xl space-y-4">
			<h2 class="text-3xl font-bold text-primary dark:text-white">
				{t("supporters.supporters.heading")}
			</h2>
			<p class="text-base text-body dark:text-slate-300">
				BTC Map is built in the open and sustained by the organisations that believe in it.
				Each sponsorship tier reflects a deeper level of commitment to open bitcoin infrastructure.
			</p>
			<a
				href="mailto:hello@btcmap.org"
				class="inline-block rounded-xl bg-link px-6 py-3 font-semibold text-white transition-colors hover:bg-hover"
			>
				{t("supporters.supporters.becomeSponsor")}
			</a>
		</div>

		<div class="space-y-6">
			{#each orgTiers as tier (tier.level)}
				<SupportSection {tier} sponsors={sponsorsByLevel[tier.level]} />
			{/each}
		</div>
	</section>

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
					<a href={network === 'Lightning' ? `lightning:${lnurlp}` : `bitcoin:${onchain}`}>
						<canvas
							use:renderQr
							class="mx-auto h-[200px] w-[200px] rounded-xl border-4 border-link transition-colors hover:border-hover sm:h-[256px] sm:w-[256px]"
						/>
					</a>

					<!-- cta -->
					<p class="text-center text-xl text-primary dark:text-white">
						{t("supporters.donate.scanOrClick")} <br class="block md:hidden" /><strong class="lowercase"
							>{network === 'Lightning' ? t("supporters.donate.lightning") : t("supporters.donate.onchain")}</strong
						>
						<img
							src={network === 'Lightning' ? '/icons/ln-highlight.svg' : '/icons/btc-highlight.svg'}
							alt={`${t(network === 'Lightning' ? "supporters.donate.lightning" : "supporters.donate.onchain")} ${t("supporters.donate.protocolAlt")}`}
							class="mb-1 inline dark:rounded-full dark:bg-white dark:p-0.5"
						/>
					</p>
				</div>
			</div>
		{:else}
			<div class="space-y-5">
				<!-- onchain -->
				<DonationOption value={onchain} textKey="supporters.donate.onchain" network="On-chain" {showQrToggle} />
				<!-- lightning -->
				<DonationOption value={lnurlp} textKey="supporters.donate.lightning" network="Lightning" {showQrToggle} />
			</div>
		{/if}
	</section>

	<section id="node">
		<!-- channel -->
		<div>
			<h3 class="text-lg font-semibold text-body uppercase dark:text-white">
				{t("supporters.node.heading")}
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
