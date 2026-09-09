<script lang="ts">
import axios from "axios";
import { onDestroy } from "svelte";
import { fade } from "svelte/transition";

import Icon from "$components/Icon.svelte";
import InvoicePaymentStage from "$components/InvoicePaymentStage.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { API_BASE } from "$lib/api-base";
import { _ } from "$lib/i18n";
import IconSocials from "$lib/icons/IconSocials.svelte";
import {
	classifyBoostError,
	isInvoicePaid,
	pollInvoiceStatus,
} from "$lib/payment";
import { boost, boostHash } from "$lib/store";
import { updateSinglePlace } from "$lib/sync/places";
import { errToast, warningToast } from "$lib/utils";

type Props = {
	merchantId: number | string;
	merchantName?: string;
	onComplete?: () => void;
};
let {
	merchantId,
	merchantName = undefined,
	onComplete = undefined,
}: Props = $props();

let stage = $state(0);

const values = [
	{ sats: 5000, time: 1 },
	{ sats: 10000, time: 3 },
	{ sats: 30000, time: 12 },
];

let tooltip = $state(false);
let selectedBoost = $state<{ sats: number; time: number; expires: Date }>();
let invoice = $state("");
let invoiceId = $state("");
let loading = $state(false);
let boostError = $state<"network" | "service" | null>(null);

onDestroy(() => {
	stage = 0;
	invoice = "";
	invoiceId = "";
	loading = false;
	selectedBoost = undefined;
	tooltip = false;
	boostError = null;
});

const handlePaymentSuccess = async () => {
	if ($boostHash === invoiceId) {
		return;
	}
	$boostHash = invoiceId;

	try {
		// Re-verify against the API before celebrating — the poller said
		// paid, but this is the cheap belt to its braces (#1348).
		const response = await pollInvoiceStatus(invoiceId);
		if (!isInvoicePaid(response.data?.status)) {
			throw new Error("Invoice not paid");
		}

		stage = 2;

		if (merchantId) {
			await updateSinglePlace(merchantId);
		}

		if (onComplete) {
			onComplete();
		}
	} catch (error) {
		// Reset the dedup guard so a retry can finalize: the poller re-fires
		// onSuccess every interval, and a set $boostHash would make each one
		// return early, wedging stage 1 after a transient re-verify failure.
		$boostHash = "";
		warningToast($_("boost.finalizeError"));
		console.error(error);
	}
};

const handlePaymentError = (error: unknown) => {
	console.error("Payment error:", error);
};

const handleStatusCheckError = (error: unknown) => {
	errToast($_("errors.invoiceStatusCheck"));
	console.error(error);
};

const retryBoost = () => {
	boostError = null;
	generateInvoice();
};

const generateInvoice = () => {
	loading = true;
	boostError = null;

	const timeToDays: Record<number, number> = { 1: 30, 3: 90, 12: 365 };
	const days = selectedBoost?.time
		? timeToDays[selectedBoost.time] || selectedBoost.time
		: undefined;

	if (!days || days <= 0) {
		errToast($_("boost.invalidDuration"));
		loading = false;
		return;
	}

	const placeId = Number(merchantId);
	if (!placeId || Number.isNaN(placeId)) {
		errToast($_("boost.invalidMerchantId"));
		loading = false;
		return;
	}

	axios
		.post(`${API_BASE}/v4/place-boosts`, {
			// The API takes the id as a string.
			place_id: placeId.toString(),
			days: days,
		})
		.then((response) => {
			invoice = response.data.invoice;
			invoiceId = response.data.invoice_id;
			stage = 1;
			loading = false;
		})
		.catch((error) => {
			boostError = classifyBoostError(error);
			console.error(error);
			loading = false;
		});
};
</script>

{#if stage === 0}
	{#if boostError}
		<div class="space-y-4 text-center">
			<Icon
				w="48"
				h="48"
				class="mx-auto text-red-500 dark:text-red-400"
				icon="error_outline"
				type="material"
			/>

			<p class="text-xl font-bold text-primary dark:text-white">
				{$_("boost.errorTitle")}
			</p>

			<p class="text-body dark:text-white">
				{boostError === "network" ? $_("boost.errorNetwork") : $_("boost.errorService")}
			</p>

			<PrimaryButton style="w-full rounded-xl p-3" disabled={loading} {loading} onclick={retryBoost}>
				{$_("boost.errorRetry")}
			</PrimaryButton>

			<p class="text-sm text-body dark:text-white">
				{$_("boost.errorContact")}
				<a
					href="mailto:hello@btcmap.org"
					class="text-link transition-colors hover:text-hover">hello@btcmap.org</a
				>
			</p>
		</div>
	{:else}
		<div class="space-y-4">
		<div>
			<p class="mb-2 text-xl font-bold text-primary dark:text-white">{$_("boost.boostLocation")}</p>

			<p class="text-sm text-body dark:text-white">
				{$_("boost.description")}
			</p>

			<button
				onmouseenter={() => (tooltip = true)}
				onmouseleave={() => (tooltip = false)}
				class="relative text-sm text-link transition-colors hover:text-hover"
				>{$_("boost.seeHowItLooks")}
				{#if tooltip}
					<div
						transition:fade={{ delay: 0, duration: 100 }}
						class="absolute -top-16 left-[26px] w-[52px] rounded-lg border border-gray-300 bg-white py-2 shadow-lg dark:border-white/95 dark:bg-dark"
					>
						<img
							src="/icons/boosted-icon-pin.svg"
							alt={$_("boost.boostedPinAlt")}
							class="mx-auto"
							width="32"
							height="43"
						/>
						<Icon
							w="20"
							h="20"
							class="absolute top-3.5 left-[15px] animate-wiggle text-white"
							icon="currency_bitcoin"
							type="material"
						/>
					</div>
				{/if}
			</button>
		</div>

		<div class="space-y-2 md:flex md:space-y-0 md:space-x-2">
			{#each values as value, index (index)}
				<button
					onclick={() => {
						let dateNow = new Date();
						let currentBoost =
							$boost && $boost.boost && new Date($boost.boost) > dateNow
								? new Date($boost.boost)
								: undefined;
						selectedBoost = {
							sats: value.sats,
							time: value.time,
							expires: currentBoost
								? new Date(currentBoost.setMonth(currentBoost.getMonth() + value.time))
								: new Date(dateNow.setMonth(dateNow.getMonth() + value.time))
						};
					}}
					class="relative w-full space-y-0.5 rounded-xl border-2 py-1 {selectedBoost &&
					selectedBoost.time === value.time
						? 'border-link text-link'
						: 'border-gray-300 text-primary dark:border-white/95 dark:text-white'} text-center transition-colors hover:border-link hover:text-link dark:hover:text-link"
				>
					{#if value.time === 3}
						<img src="/icons/star.svg" alt={$_("boost.starAlt")} class="absolute top-1 right-1" />
					{/if}

					<p class="text-xs">
						{value.time === 1
							? $_("boost.duration1Month")
							: $_("boost.durationNMonths", { values: { time: value.time } })}
					</p>
					<p class="font-bold">{value.sats.toLocaleString()} sats</p>
				</button>
			{/each}
		</div>

		<p class="text-xs text-body dark:text-white">
			{$_("boost.feeNote")}
		</p>

		<PrimaryButton
			style="w-full rounded-xl p-3 {!selectedBoost ? 'opacity-50 hover:bg-link' : ''}"
			disabled={!selectedBoost || loading}
			{loading}
			onclick={generateInvoice}
		>
			{selectedBoost
				? selectedBoost.time === 1
					? $_("boost.boostFor1Month")
					: $_("boost.boostForNMonths", {
							values: { time: selectedBoost.time },
						})
				: $_("boost.boostAction")}
		</PrimaryButton>
	</div>
	{/if}
{:else if stage === 1}
	<InvoicePaymentStage
		{invoice}
		{invoiceId}
		onSuccess={handlePaymentSuccess}
		onError={handlePaymentError}
		onStatusCheckError={handleStatusCheckError}
		description={selectedBoost
			? selectedBoost.time === 1
				? $_("boost.invoiceDescription1", {
						values: { sats: selectedBoost.sats.toLocaleString() },
					})
				: $_("boost.invoiceDescriptionN", {
						values: {
							time: selectedBoost.time,
							sats: selectedBoost.sats.toLocaleString(),
						},
					})
			: ""}
	/>
{:else}
	<div class="space-y-4 text-center">
		<p
			class="text-xl font-bold text-primary dark:text-white {merchantName?.match('([^ ]{14})')
				? 'break-all'
				: ''}"
		>
			{$_("boost.thankYou", {
				values: { name: merchantName || $_("boost.thisLocation") },
			})}
		</p>

		<p class="text-body dark:text-white">
			{$_("boost.boostedUntil")} <br />
			<strong
				>{selectedBoost?.expires.toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})}</strong
			>
		</p>

		<a
			href="https://twitter.com/share?text={encodeURIComponent($_('boost.twitterShareText', { values: { name: merchantName || $_('boost.thisLocation') } }))}&url=https://btcmap.org/merchant/{merchantId}&hashtags=bitcoin"
			target="_blank"
			rel="noreferrer"
			class="mx-auto flex w-[200px] items-center justify-center rounded-xl bg-twitter py-3 text-white"
			>{$_("boost.shareOnTwitter")} <IconSocials w="24" h="24" class="ml-2" icon="x" /></a
		>

		<p class="text-sm text-body dark:text-white">
			{$_("boost.shareEncourage")}
		</p>
	</div>
{/if}
