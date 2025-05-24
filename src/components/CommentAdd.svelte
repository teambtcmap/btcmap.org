<script lang="ts">
	import { CloseButton, CopyButton, Icon, PrimaryButton } from '$lib/comp';
	// import { boost, boostHash, exchangeRate, resetBoost } from '$lib/store';
	import { errToast, warningToast } from '$lib/utils';
	import axios from 'axios';
	import JSConfetti from 'js-confetti';
	import QRCode from 'qrcode';
	import { tick } from 'svelte';
	import OutClick from 'svelte-outclick';
	import { fade, fly } from 'svelte/transition';
	import type { MerchantPageData } from '$lib/types.js';

	export let open: boolean = false;
	export let merchantName: MerchantPageData['name'] | undefined;
	export let elementId: MerchantPageData['id'] | undefined;

	const COMMENT_AMOUNT_IN_SATS = 500;

	let stage = 0;

	let commentValue: string = '';

	// let boostComplete = false;
	let commentPosted = false;

	const closeModal = () => {
		// if (boostComplete) {
		// 	location.reload();
		// }
		// $boost = undefined;
		// $exchangeRate = undefined;
		open = false;
		stage = 0;
		invoice = '';
		hash = '';
		clearInterval(checkInvoiceInterval);
		jsConfetti.clearCanvas();
		loading = false;
		commentPosted = false;
		// $resetBoost = $resetBoost + 1;
	};

	let invoice = '';
	let hash = '';
	let qr: HTMLCanvasElement;
	let checkInvoiceInterval: ReturnType<typeof setInterval>;
	let loading = false;

	const jsConfetti = new JSConfetti();
	// @ts-expect-error
	document.querySelector('canvas').style.zIndex = '2001';

	const postComment = () => {
		axios
			.post('/comment/post', {
				element_id: elementId,
				content: commentValue,
				payment_hash: hash
			})
			.then(function (response) {
				console.info('Comment posted successfully:', response.data);
				commentPosted = true;
			})
			.catch(function (error) {
				warningToast('Could not post comment, please contact BTC Map.');
				console.error(error);
			});
	};

	const checkInvoice = () => {
		axios
			.get(`/comment/invoice/status?hash=${hash}`)
			.then(function (response) {
				// Check if the invoice is paid
				if (response.data.status === 'paid') {
					clearInterval(checkInvoiceInterval);

					// If comment hasn't been posted yet, post it
					if (!commentPosted) {
						postComment();
					}

					// Show success screen
					stage = 2;
					jsConfetti.addConfetti();
				}
			})
			.catch(function (error) {
				errToast('Could not check invoice status, please try again or contact BTC Map.');
				console.error(error);
			});
	};

	const generateInvoice = () => {
		console.log('generateInvoice', commentValue);
		console.log('merchant', merchantName);
		console.log('elementId', elementId);

		loading = true;
		axios
			.get(`/comment/invoice/generate?amount=${COMMENT_AMOUNT_IN_SATS}&name=${merchantName}`)
			.then(async function (response) {
				invoice = response.data['payment_request'];
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

				// Start checking invoice status
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

{#if open}
	<OutClick excludeQuerySelectorAll="#boost-button" on:outclick={closeModal}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center-fixed z-[2000] max-h-[90vh] w-[90vw] overflow-auto rounded-xl border border-mapBorder bg-white p-6 text-left shadow-2xl dark:bg-dark md:w-[430px]"
		>
			<CloseButton
				position="flex justify-end"
				on:click={closeModal}
				colors="text-primary dark:text-white dark:hover:text-white/80 hover:text-link"
			/>

			{#if stage === 0}
				<form class="space-y-4" on:submit|preventDefault={generateInvoice}>
					<legend>
						<p class="mb-2 text-xl font-bold text-primary dark:text-white">Add Comment</p>

						<p class="text-sm text-body dark:text-white">
							All comments are anonymous but we collect a small fee in sats as a spam protection
							measure
						</p>
						<p class="text-sm text-body dark:text-white">Current fee: 500 sats</p>
					</legend>

					<div>
						<label for="comment" class="mb-2 block font-semibold">Your comment</label>
						<textarea
							name="comment"
							rows="3"
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
							bind:value={commentValue}
						/>
					</div>

					<PrimaryButton style="w-full rounded-xl p-3" disabled={loading} type="submit" {loading}>
						Comment
					</PrimaryButton>
				</form>
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

					<p class="text-xl font-bold text-primary dark:text-white">
						Once the invoice is paid and confirmed by our backend the comment will be posted
					</p>
				</div>
			{:else if stage === 2}
				<div class="space-y-4 text-center">
					<p class="text-xl font-bold text-primary dark:text-white">Thank you for your comment!</p>

					<p class="text-body dark:text-white">
						Yeah, payment received, our bots are working on posting your comment it will be live
						within the next block.
					</p>

					<PrimaryButton style="w-full rounded-xl p-3" on:click={closeModal}>Close</PrimaryButton>
				</div>
			{/if}
		</div>
	</OutClick>
{/if}
