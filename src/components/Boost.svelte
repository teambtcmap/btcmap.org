<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { CloseButton, CopyButton, Icon, PrimaryButton, InvoicePayment } from '$lib/comp';
	import { PAYMENT_ERROR_MESSAGE, STATUS_CHECK_ERROR_MESSAGE } from '$lib/constants';
	import { boost, boostHash, exchangeRate, resetBoost } from '$lib/store';
	import { errToast, warningToast } from '$lib/utils';
	import axios from 'axios';
	import OutClick from 'svelte-outclick';
	import { fade, fly } from 'svelte/transition';

	let stage = 0;

	const values = [
		{ fiat: 5, time: 1 },
		{ fiat: 10, time: 3 },
		{ fiat: 30, time: 12 }
	];

	let tooltip = false;
	let selectedBoost: { fiat: number; sats: string; time: number; expires: Date } | undefined;
	let boostComplete = false;
	const closeModal = () => {
		if (boostComplete) {
			invalidateAll();
		}
		$boost = undefined;
		$exchangeRate = undefined;
		selectedBoost = undefined;
		stage = 0;
		invoice = '';
		invoiceId = '';
		tooltip = false;
		loading = false;
		$resetBoost = $resetBoost + 1;
	};

	let invoice = '';
	let invoiceId = '';
	let loading = false;

	const handlePaymentSuccess = () => {
		if ($boostHash === invoiceId) {
			return;
		}
		$boostHash = invoiceId;

		axios
			.get(`https://api.btcmap.org/v4/invoices/${invoiceId}`)
			.then(function (response) {
				if (response.data.status === 'paid') {
					stage = 2;
					boostComplete = true;
					console.info(response);
				} else {
					warningToast('Payment not confirmed yet, please try again.');
				}
			})
			.catch(function (error) {
				warningToast('Could not finalize boost, please contact BTC Map.');
				console.error(error);
			});
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
		const satsAmount = parseInt(selectedBoost?.sats || '0');

		if (isNaN(satsAmount) || satsAmount <= 0) {
			errToast('Invalid sats amount');
			loading = false;
			return;
		}

		// Convert months to days (1 month = 30 days, 3 months = 90 days, 12 months = 365 days)
		const days =
			selectedBoost?.time === 1
				? 30
				: selectedBoost?.time === 3
					? 90
					: selectedBoost?.time === 12
						? 365
						: selectedBoost?.time;

		axios
			.post('https://api.btcmap.org/v4/place-boosts', {
				place_id: $boost?.id,
				sats_amount: satsAmount,
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

{#if $boost && $exchangeRate}
	<OutClick excludeQuerySelectorAll="#boost-button" on:outclick={closeModal}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center-fixed z-[2000] max-h-[90vh] w-[90vw] overflow-auto rounded-xl border border-mapBorder bg-white p-6 text-left shadow-2xl dark:bg-dark md:w-[430px]"
		>
			<CloseButton on:click={closeModal} />

			{#if stage === 0}
				<div class="space-y-4">
					<div>
						<p class="mb-2 text-xl font-bold text-primary dark:text-white">Boost Location</p>

						<p class="text-sm text-body dark:text-white">
							Make this merchant stand out in bitcoin orange on the map, shine in the search
							results, and be discovered in the exclusive boosted locations map!
						</p>

						<button
							on:mouseenter={() => (tooltip = true)}
							on:mouseleave={() => (tooltip = false)}
							class="relative text-sm text-link transition-colors hover:text-hover"
							>See how it looks
							{#if tooltip}
								<div
									transition:fade={{ delay: 0, duration: 100 }}
									class="absolute -top-16 left-[26px] w-[52px] rounded-lg border border-mapBorder bg-white py-2 shadow-lg dark:bg-dark"
								>
									<Icon w="32" h="43" style="mx-auto" icon="boosted-icon-pin" type="popup" />
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

					<div class="space-y-2 md:flex md:space-x-2 md:space-y-0">
						{#each values as value, index (index)}
							<button
								on:click={() => {
									if (!$exchangeRate) return;

									let dateNow = new Date();
									let currentBoost =
										$boost && $boost.boost && new Date($boost.boost) > dateNow
											? new Date($boost.boost)
											: undefined;
									selectedBoost = {
										fiat: value.fiat,
										sats: (value.fiat / ($exchangeRate / 100000000)).toFixed(0),
										time: value.time,
										expires: currentBoost
											? new Date(currentBoost.setMonth(currentBoost.getMonth() + value.time))
											: new Date(dateNow.setMonth(dateNow.getMonth() + value.time))
									};
								}}
								class="relative w-full space-y-0.5 rounded-xl border-2 py-1 {selectedBoost &&
								selectedBoost.time === value.time
									? 'border-link text-link'
									: 'border-mapBorder text-primary dark:text-white'} text-center transition-colors hover:border-link hover:text-link dark:hover:text-link"
							>
								{#if value.time === 3}
									<img src="/icons/star.svg" alt="star" class="absolute right-1 top-1" />
								{/if}

								<p>${value.fiat}</p>
								<p class="text-xs">{(value.fiat / ($exchangeRate / 100000000)).toFixed(0)} sats</p>
								<p class="text-xs">{value.time} month</p>
							</button>
						{/each}
					</div>

					<p class="text-xs text-body dark:text-white">
						The fee is used to support the BTC Map open source project and continue it's
						development.
					</p>

					<p class="text-xs text-body dark:text-white">
						*Fiat exchange rates may change during payment flow.
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
				<div class="space-y-4 text-center">
					<p class="text-xl font-bold text-primary dark:text-white">
						Scan or click to pay with lightning
					</p>

					<a href="lightning:{invoice}" class="inline-block">
						<InvoicePayment
							{invoice}
							{invoiceId}
							onSuccess={handlePaymentSuccess}
							onError={handlePaymentError}
							onStatusCheckError={handleStatusCheckError}
						/>
					</a>

					{#if selectedBoost}
						<p class="text-body dark:text-white">
							Boost this location for <strong
								>{selectedBoost.time} month{selectedBoost.time > 1 ? 's' : ''} <br />
								${selectedBoost.fiat}</strong
							>
							(<strong>{selectedBoost.sats} sats</strong>)
						</p>
					{/if}

					<div
						class="flex w-full items-center justify-between space-x-2 rounded-xl border-2 border-mapBorder p-2 md:justify-center"
					>
						<p class="hidden text-sm text-body dark:text-white md:block">
							{invoice.slice(0, 39)}...
						</p>
						<p class="block text-sm uppercase text-body dark:text-white md:hidden">
							Invoice <img
								src="/icons/ln-highlight.svg"
								alt="protocol"
								class="mb-1 inline dark:rounded-full dark:bg-white dark:p-0.5"
							/>
						</p>

						<CopyButton value={invoice} />
					</div>
				</div>
			{:else}
				<div class="space-y-4 text-center">
					<p
						class="text-xl font-bold text-primary dark:text-white {$boost.name.match('([^ ]{14})')
							? 'break-all'
							: ''}"
					>
						Thank you for supporting {$boost.name ? $boost.name : 'this location'} & BTC Map!
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
						href="https://twitter.com/share?text=I just boosted {$boost.name
							? encodeURIComponent($boost.name)
							: 'this location'} on @btcmap. Check them out!&url=https://btcmap.org/merchant/{$boost.id}&hashtags=bitcoin"
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
		</div>
	</OutClick>
{/if}
