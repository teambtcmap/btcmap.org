<script lang="ts">
	import { CloseButton, CopyButton, Icon, PrimaryButton } from '$lib/comp';
	import { CONFETTI_CANVAS_Z_INDEX } from '$lib/constants';
	import { errToast } from '$lib/utils';
	import axios from 'axios';
	import QRCode from 'qrcode';
	import JSConfetti from 'js-confetti';
	import { tick } from 'svelte';
	import OutClick from 'svelte-outclick';
	import { fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import type { MerchantPageData } from '$lib/types.js';

	export let open: boolean = false;
	export let elementId: MerchantPageData['id'] | undefined;

	let stage = 0;
	let commentValue: string = '';
	let invoice = '';
	let invoiceId = '';
	let qr: HTMLCanvasElement;
	let loading = false;
	let polling = false;
	let pollInterval: ReturnType<typeof setInterval>;

	const jsConfetti = new JSConfetti();
	// @ts-expect-error: Required for js-confetti canvas z-index manipulation
	document.querySelector('canvas').style.zIndex = CONFETTI_CANVAS_Z_INDEX;
	const closeModal = () => {
		open = false;
		stage = 0;
		invoice = '';
		invoiceId = '';
		loading = false;
		polling = false;
		if (pollInterval) clearInterval(pollInterval);
		jsConfetti.clearCanvas();
	};

	const generateInvoice = () => {
		if (!elementId || !commentValue.trim()) {
			errToast('Please enter a comment');
			return;
		}

		loading = true;
		axios
			.post('/comment/invoice/generate', {
				place_id: elementId,
				comment: commentValue.trim()
			})
			.then(async function (response) {
				invoice = response.data.invoice;
				invoiceId = response.data.invoice_id;
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

				loading = false;
				startPolling();
			})
			.catch(function (error) {
				errToast('Could not generate invoice, please try again or contact BTC Map.');
				console.error(error);
				loading = false;
			});
	};

	const checkInvoiceStatus = async () => {
		if (!invoiceId) return;

		try {
			const response = await axios.get(`https://api.btcmap.org/v4/invoices/${invoiceId}`);
			if (response.data.status === 'paid') {
				polling = false;
				clearInterval(pollInterval);
				// Comment will be published automatically by the backend
				invalidateAll(); // Refresh comments immediately
				stage = 2;
				jsConfetti.addConfetti();
			}
		} catch (error) {
			console.error('Error checking invoice status:', error);
		}
	};

	const startPolling = () => {
		polling = true;
		pollInterval = setInterval(checkInvoiceStatus, 3000); // Check every 3 seconds
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
							All comments are currently anonymous. We collect a small fee in sats as a spam
							protection measure.
						</p>
						<p class="text-sm text-body dark:text-white">Current fee: 500 sats</p>
					</legend>

					<div>
						<label for="comment" class="mb-2 block font-semibold text-primary dark:text-white"
							>Your comment</label
						>
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

					<p class="rounded-md border p-1 text-sm text-body dark:text-white">
						<Icon w="16" h="16" icon="info" style="inline-block" />
						{#if polling}
							Checking payment status...
						{:else}
							Your comment will be published<br /> when our bots have confirmed the payment.
						{/if}
					</p>

					<PrimaryButton style="w-full rounded-xl p-3" on:click={closeModal}>Close</PrimaryButton>
				</div>
			{:else}
				<div class="space-y-4 text-center">
					<p class="text-xl font-bold text-primary dark:text-white">Thank you for your comment!</p>

					<p class="text-body dark:text-white">Your comment has been published!</p>

					<PrimaryButton style="w-full rounded-xl p-3" on:click={closeModal}>Close</PrimaryButton>
				</div>
			{/if}
		</div>
	</OutClick>
{/if}
