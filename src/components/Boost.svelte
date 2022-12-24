<script>
	import axios from 'axios';
	import QRCode from 'qrcode';
	import OutClick from 'svelte-outclick';
	import { LottiePlayer } from '@lottiefiles/svelte-lottie-player';
	import JSConfetti from 'js-confetti';
	import { tick } from 'svelte';
	import { boost, exchangeRate, resetBoost } from '$lib/store';
	import { PrimaryButton, CopyButton, Icon, CloseButton } from '$comp';
	import { fly, fade } from 'svelte/transition';
	import { errToast, warningToast } from '$lib/utils';

	let stage = 0;

	const values = [
		{ fiat: 5, time: 1 },
		{ fiat: 10, time: 3 },
		{ fiat: 30, time: 12 }
	];

	let tooltip;

	let selectedBoost;
	let boostComplete;

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
	let qr;
	let checkInvoiceInterval;
	let loading = false;

	const jsConfetti = new JSConfetti();
	document.querySelector('canvas').style.zIndex = '2001';

	const checkInvoice = () => {
		axios
			.get(`/boost/invoice/status?hash=${hash}`)
			.then(function (response) {
				if (response.data.paid === true) {
					clearInterval(checkInvoiceInterval);

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
							console.log(response);
						})
						.catch(function (error) {
							warningToast('Could not finalize boost, please contact BTC Map.');
							console.log(error);
						});
				}
			})
			.catch(function (error) {
				errToast('Could not check invoice status, please try again or contact BTC Map.');
				console.log(error);
			});
	};

	const generateInvoice = () => {
		loading = true;
		axios
			.get(
				`/boost/invoice/generate?amount=${selectedBoost.sats}&name=${$boost.name.replaceAll(
					'&',
					'%26'
				)}&time=${selectedBoost.time}`
			)
			.then(async function (response) {
				invoice = response.data['payment_request'];
				hash = response.data['payment_hash'];

				stage = 1;

				await tick();

				QRCode.toCanvas(
					qr,
					invoice,
					{ width: window.innerWidth > 768 ? 275 : 200 },
					function (error) {
						if (error) {
							errToast('Could not generate QR, please try again or contact BTC Map.');
							console.error(error);
						}
					}
				);

				checkInvoiceInterval = setInterval(checkInvoice, 1000);

				loading = false;
			})
			.catch(function (error) {
				errToast('Could not generate invoice, please try again or contact BTC Map.');
				console.log(error);
				loading = false;
			});
	};
</script>

{#if $boost && $exchangeRate}
	<OutClick excludeQuerySelectorAll={['#boost-button']} on:outclick={closeModal}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center z-[2000] border border-mapBorder max-h-[90vh] w-[90vw] md:w-[430px] bg-white p-6 rounded-xl shadow-2xl overflow-auto"
		>
			<CloseButton
				position="flex justify-end"
				click={closeModal}
				colors="text-primary hover:text-link"
			/>

			{#if stage === 0}
				<div class="space-y-4">
					<div>
						<p class="text-primary text-xl font-bold mb-2">Boost Location</p>

						<p class="text-body text-sm">
							Make this merchant stand out in bitcoin orange on the map, shine in the search
							results, and be discovered in the exclusive boosted locations map!
						</p>

						<button
							on:mouseenter={() => (tooltip = true)}
							on:mouseleave={() => (tooltip = false)}
							class="relative text-sm text-link hover:text-hover transition-colors"
							>See how it looks
							{#if tooltip}
								<div
									transition:fade={{ delay: 0, duration: 100 }}
									class="absolute -top-16 left-[26px] w-[52px] bg-white shadow-lg rounded-lg py-2 border border-mapBorder"
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

					<div class="md:flex space-y-2 md:space-y-0 md:space-x-2">
						{#each values as value}
							<button
								on:click={() => {
									let currentBoost = $boost && $boost.boost ? new Date($boost.boost) : undefined;
									let dateNow = new Date();
									selectedBoost = {
										fiat: value.fiat,
										sats: (value.fiat / ($exchangeRate / 100000000)).toFixed(0),
										time: value.time,
										expires: currentBoost
											? new Date(currentBoost.setMonth(currentBoost.getMonth() + value.time))
											: new Date(dateNow.setMonth(dateNow.getMonth() + value.time))
									};
								}}
								class="relative space-y-0.5 w-full py-1 rounded-xl border-2 {selectedBoost &&
								selectedBoost.time === value.time
									? 'border-link text-link'
									: 'border-mapBorder text-primary'} hover:border-link hover:text-link text-center transition-colors"
							>
								{#if value.time === 3}
									<img src="/icons/star.svg" alt="star" class="absolute top-1 right-1" />
								{/if}

								<p>${value.fiat}</p>
								<p class="text-xs">{(value.fiat / ($exchangeRate / 100000000)).toFixed(0)} sats</p>
								<p class="text-xs">{value.time} month</p>
							</button>
						{/each}
					</div>

					<p class="text-body text-xs">
						The fee is used to support the BTC Map open source project and continue it's
						development.
					</p>

					<p class="text-body text-xs">*Fiat exchange rates may change during payment flow.</p>

					<PrimaryButton
						text={selectedBoost
							? `Boost for ${selectedBoost.time} month${selectedBoost.time > 1 ? 's' : ''}`
							: 'Boost'}
						style="w-full rounded-xl p-3 {!selectedBoost ? 'opacity-50 hover:bg-link' : ''}"
						disabled={!selectedBoost || loading}
						click={generateInvoice}
						{loading}
					/>
				</div>
			{:else if stage === 1}
				<div class="text-center space-y-4">
					<p class="text-primary font-bold text-xl">Scan or click to pay with lightning</p>

					<a href="lightning:{invoice}" class="inline-block">
						<canvas
							class="w-[200px] md:w-[275px] h-[200px] md:h-[275px] mx-auto border-2 border-mapBorder hover:border-link rounded-2xl transition-colors"
							bind:this={qr}
						/>
					</a>

					<p class="text-body">
						Boost this location for <strong
							>{selectedBoost.time} month{selectedBoost.time > 1 ? 's' : ''} <br />
							${selectedBoost.fiat}</strong
						>
						(<strong>{selectedBoost.sats} sats</strong>)
					</p>

					<div
						class="border-2 border-mapBorder rounded-xl space-x-2 p-2 w-full flex justify-between md:justify-center items-center"
					>
						<p class="text-body text-sm hidden md:block">{invoice.slice(0, 39)}...</p>
						<p class="text-body text-sm block md:hidden uppercase">
							Invoice <img src="/icons/ln-highlight.svg" alt="protocol" class="inline mb-1" />
						</p>

						<CopyButton value={invoice} />
					</div>
				</div>
			{:else}
				<div class="space-y-4 text-center">
					{#if typeof window !== 'undefined'}
						<div class="w-44 h-[99px] mx-auto">
							<LottiePlayer
								src="/lottie/boost.json"
								autoplay={true}
								loop={true}
								controls={false}
								renderer="svg"
								background="transparent"
							/>
						</div>
					{/if}

					<p
						class="text-primary font-bold text-xl {$boost.name.match('([^ ]{14})')
							? 'break-all'
							: ''}"
					>
						Thank you for supporting {$boost.name ? $boost.name : 'this location'} & BTC Map!
					</p>

					<p class="text-body">
						This location will be boosted until <br />
						<strong
							>{selectedBoost.expires.toLocaleDateString(undefined, {
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}</strong
						>
					</p>

					<a
						href="https://twitter.com/share?text=I just boosted {$boost.name
							? $boost.name.replaceAll('&', '%26')
							: 'this location'} on @BTCMapDotOrg. Check them out!&url=https://btcmap.org/map?lat={$boost.lat}%26long={$boost.long}&hashtags=bitcoin"
						target="_blank"
						rel="noreferrer"
						class="bg-twitter text-white rounded-xl w-[200px] mx-auto py-3 flex justify-center items-center"
						>Share on Twitter <Icon w="24" h="24" style="ml-2" icon="twitter" type="socials" /></a
					>

					<p class="text-body text-sm">
						Sharing your support may encourage <br /> others to show theirs 🥰
					</p>
				</div>
			{/if}
		</div>
	</OutClick>
{/if}
