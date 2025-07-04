<script lang="ts">
	import { CloseButton, CopyButton, Icon, PrimaryButton } from '$lib/comp';
	import { boost, boostHash, exchangeRate, resetBoost } from '$lib/store';
	import { errToast, warningToast } from '$lib/utils';
	import axios from 'axios';
	import JSConfetti from 'js-confetti';
	import QRCode from 'qrcode';
	import { tick } from 'svelte';
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
			location.reload();
		}
		$boost = undefined;
		$exchangeRate = undefined;
		selectedBoost = undefined;
		stage = 0;
		invoice = '';
		hash = '';
		clearInterval(checkInvoiceInterval);
		jsConfetti.clearCanvas();
		tooltip = false;
		loading = false;
		$resetBoost = $resetBoost + 1;
	};

	let invoice = '';
	let hash = '';
	let qr: HTMLCanvasElement;
	let checkInvoiceInterval: ReturnType<typeof setInterval>;
	let loading = false;

	const jsConfetti = new JSConfetti();
	// @ts-expect-error
	document.querySelector('canvas').style.zIndex = '2001';

	const checkInvoice = () => {
		axios
			.get(`/boost/invoice/status?hash=${hash}`)
			.then(function (response) {
				if (response.data.paid === true && $boost && selectedBoost) {
					clearInterval(checkInvoiceInterval);

					if ($boostHash === hash) {
						return;
					}
					$boostHash = hash;

					axios
						.post('/boost/post', {
							element: $boost.id,
							time: selectedBoost.time,
							hash
						})
						.then(function (response) {
							stage = 2;
							jsConfetti.addConfetti();
							boostComplete = true;
							console.info(response);
						})
						.catch(function (error) {
							warningToast('Could not finalize boost, please contact BTC Map.');
							console.error(error);
						});
				}
			})
			.catch(function (error) {
				errToast('Could not check invoice status, please try again or contact BTC Map.');
				console.error(error);
			});
	};

	const generateInvoice = () => {
		loading = true;
		axios
			.get(
				`/boost/invoice/generate?amount=${selectedBoost?.sats}&name=${encodeURIComponent($boost?.name || 'location')}&time=${selectedBoost?.time}`
			)
			.then(async function (response) {
				invoice = response.data['bolt11'];
				hash = response.data['payment_hash'];

				stage = 1;

				await tick();

				QRCode.toCanvas(
					qr,
					invoice,
					{ width: window.innerWidth > 768 ? 275 : 200 },
					function (error: Error | null | undefined) {
						if (error) {
							errToast('Could not generate QR, please try again or contact BTC Map.');
							console.error(error);
						}
					}
				);

				checkInvoiceInterval = setInterval(checkInvoice, 2500);

				loading = false;
			})
			.catch(function (error) {
				errToast('Could not generate invoice, please try again or contact BTC Map.');
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
						<canvas
							class="mx-auto h-[200px] w-[200px] rounded-2xl border-2 border-mapBorder transition-colors hover:border-link md:h-[275px] md:w-[275px]"
							bind:this={qr}
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
