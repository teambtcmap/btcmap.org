<script lang="ts">
	import Icon from '$components/Icon.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { PAYMENT_ERROR_MESSAGE, STATUS_CHECK_ERROR_MESSAGE } from '$lib/constants';
	import { boost, boostHash, lastUpdatedPlaceId } from '$lib/store';
	import { updateSinglePlace } from '$lib/sync/places';
	import { errToast, warningToast } from '$lib/utils';
	import axios from 'axios';
	import { fade } from 'svelte/transition';
	import { onDestroy } from 'svelte';
	import InvoicePaymentStage from '$components/InvoicePaymentStage.svelte';

	export let merchantId: number | string;
	export let merchantName: string | undefined = undefined;
	export let onComplete: (() => void) | undefined = undefined;

	let stage = 0;

	const values = [
		{ sats: 5000, time: 1 },
		{ sats: 10000, time: 3 },
		{ sats: 30000, time: 12 }
	];

	let tooltip = false;
	let selectedBoost: { sats: number; time: number; expires: Date } | undefined;
	let invoice = '';
	let invoiceId = '';
	let loading = false;

	onDestroy(() => {
		stage = 0;
		invoice = '';
		invoiceId = '';
		loading = false;
		selectedBoost = undefined;
		tooltip = false;
	});

	const handlePaymentSuccess = async () => {
		if ($boostHash === invoiceId) {
			return;
		}
		$boostHash = invoiceId;

		try {
			const response = await axios.post('/api/boost/post', {
				invoice_id: invoiceId
			});

			stage = 2;
			console.info(response);

			if (merchantId) {
				await updateSinglePlace(merchantId);
				lastUpdatedPlaceId.set(Number(merchantId));
			}

			if (onComplete) {
				onComplete();
			}
		} catch (error) {
			warningToast('Could not finalize boost, please contact BTC Map.');
			console.error(error);
		}
	};

	const handlePaymentError = (error: unknown) => {
		console.error('Payment error:', error);
	};

	const handleStatusCheckError = (error: unknown) => {
		errToast(STATUS_CHECK_ERROR_MESSAGE);
		console.error(error);
	};

	const generateInvoice = () => {
		loading = true;

		const timeToDays: Record<number, number> = { 1: 30, 3: 90, 12: 365 };
		const days = selectedBoost?.time
			? timeToDays[selectedBoost.time] || selectedBoost.time
			: undefined;

		if (!days || days <= 0) {
			errToast('Invalid boost duration');
			loading = false;
			return;
		}

		const placeId = Number(merchantId);
		if (!placeId || isNaN(placeId)) {
			errToast('Invalid merchant ID');
			loading = false;
			return;
		}

		axios
			.post('/api/boost/invoice/generate', {
				place_id: placeId,
				days: days
			})
			.then(function (response) {
				invoice = response.data.invoice;
				invoiceId = response.data.invoice_id;
				stage = 1;
				loading = false;
			})
			.catch(function (error) {
				errToast(PAYMENT_ERROR_MESSAGE);
				console.error(error);
				loading = false;
			});
	};
</script>

{#if stage === 0}
	<div class="space-y-4">
		<div>
			<p class="mb-2 text-xl font-bold text-primary dark:text-white">Boost Location</p>

			<p class="text-sm text-body dark:text-white">
				Make this merchant stand out in bitcoin orange on the map, shine in the search results, and
				be discovered in the exclusive boosted locations map!
			</p>

			<button
				on:mouseenter={() => (tooltip = true)}
				on:mouseleave={() => (tooltip = false)}
				class="relative text-sm text-link transition-colors hover:text-hover"
				>See how it looks
				{#if tooltip}
					<div
						transition:fade={{ delay: 0, duration: 100 }}
						class="absolute -top-16 left-[26px] w-[52px] rounded-lg border border-gray-300 bg-white py-2 shadow-lg dark:border-white/95 dark:bg-dark"
					>
						<img
							src="/icons/boosted-icon-pin.svg"
							alt="Boosted pin"
							class="mx-auto"
							width="32"
							height="43"
						/>
						<Icon
							w="20"
							h="20"
							style="animate-wiggle absolute top-3.5 left-[15px] text-white"
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
					on:click={() => {
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
						<img src="/icons/star.svg" alt="star" class="absolute top-1 right-1" />
					{/if}

					<p class="text-xs">{value.time} month{value.time > 1 ? 's' : ''}</p>
					<p class="font-bold">{value.sats.toLocaleString()} sats</p>
				</button>
			{/each}
		</div>

		<p class="text-xs text-body dark:text-white">
			The fee is used to support the BTC Map open source project and continue it's development.
		</p>

		<PrimaryButton
			style="w-full rounded-xl p-3 {!selectedBoost ? 'opacity-50 hover:bg-link' : ''}"
			disabled={!selectedBoost || loading}
			{loading}
			on:click={generateInvoice}
		>
			{selectedBoost
				? `Boost for ${selectedBoost.time} month${selectedBoost.time > 1 ? 's' : ''}`
				: 'Boost'}
		</PrimaryButton>
	</div>
{:else if stage === 1}
	<InvoicePaymentStage
		{invoice}
		{invoiceId}
		onSuccess={handlePaymentSuccess}
		onError={handlePaymentError}
		onStatusCheckError={handleStatusCheckError}
		description={selectedBoost
			? `Boost this location for <strong>${selectedBoost.time} month${selectedBoost.time > 1 ? 's' : ''} <br /> ${selectedBoost.sats.toLocaleString()} sats</strong>`
			: ''}
	/>
{:else}
	<div class="space-y-4 text-center">
		<p
			class="text-xl font-bold text-primary dark:text-white {merchantName?.match('([^ ]{14})')
				? 'break-all'
				: ''}"
		>
			Thank you for supporting {merchantName || 'this location'} & BTC Map!
		</p>

		<p class="text-body dark:text-white">
			This location will be boosted until <br />
			<strong
				>{selectedBoost?.expires.toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})}</strong
			>
		</p>

		<a
			href="https://twitter.com/share?text=I just boosted {merchantName
				? encodeURIComponent(merchantName)
				: 'this location'} on @btcmap. Check them out!&url=https://btcmap.org/merchant/{merchantId}&hashtags=bitcoin"
			target="_blank"
			rel="noreferrer"
			class="mx-auto flex w-[200px] items-center justify-center rounded-xl bg-twitter py-3 text-white"
			>Share on Twitter <Icon w="24" h="24" style="ml-2" icon="twitter" type="socials" /></a
		>

		<p class="text-sm text-body dark:text-white">
			Sharing your support may encourage <br /> others to show theirs 🥰
		</p>
	</div>
{/if}
