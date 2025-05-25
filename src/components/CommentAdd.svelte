<script lang="ts">
	import { CloseButton, CopyButton, Icon, PrimaryButton } from '$lib/comp';
	import { errToast } from '$lib/utils';
	import axios from 'axios';
	import QRCode from 'qrcode';
	import { tick } from 'svelte';
	import OutClick from 'svelte-outclick';
	import { fade, fly } from 'svelte/transition';
	import type { MerchantPageData } from '$lib/types.js';

	export let open: boolean = false;
	export let elementId: MerchantPageData['id'] | undefined;

	let stage = 0;
	let commentValue: string = '';
	let invoice = '';
	let qr: HTMLCanvasElement;
	let loading = false;

	const closeModal = () => {
		open = false;
		stage = 0;
		invoice = '';
		loading = false;
	};

	const generateInvoice = () => {
		if (!elementId || !commentValue.trim()) {
			errToast('Please enter a comment');
			return;
		}

		loading = true;
		axios
			.post('/comment/invoice/generate', {
				element_id: elementId,
				comment: commentValue.trim()
			})
			.then(async function (response) {
				invoice = response.data.payment_request;
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

					<p class="text-sm text-body dark:text-white">
						Once the payment is confirmed, your comment will appear on the map automatically.
					</p>

					<PrimaryButton style="w-full rounded-xl p-3" on:click={closeModal}>Close</PrimaryButton>
				</div>
			{/if}
		</div>
	</OutClick>
{/if}
