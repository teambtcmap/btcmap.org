<script lang="ts">
	import { CopyButton, InvoicePayment } from '$lib/comp';

	export let invoice: string;
	export let invoiceId: string;
	export let onSuccess: () => void | Promise<void>;
	export let onError: (error: unknown) => void;
	export let onStatusCheckError: (error: unknown) => void;
	export let description: string = '';

	// HTML description is controlled by the parent components (BoostContent)
	// Content is generated from trusted variables, not user input
	$: descriptionHtml = description;
</script>

<div class="space-y-4 text-center">
	<p class="text-xl font-bold text-primary dark:text-white">Scan or click to pay with lightning</p>

	<a href="lightning:{invoice}" class="inline-block">
		<InvoicePayment {invoice} {invoiceId} {onSuccess} {onError} {onStatusCheckError} />
	</a>

	{#if descriptionHtml}
		<p class="text-body dark:text-white">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html descriptionHtml}
		</p>
	{/if}

	<div
		class="flex w-full items-center justify-between space-x-2 rounded-xl border-2 border-gray-300 p-2 md:justify-center dark:border-white/95"
	>
		<p class="hidden text-sm text-body md:block dark:text-white">
			{invoice.slice(0, 39)}...
		</p>
		<p class="block text-sm text-body uppercase md:hidden dark:text-white">
			Invoice <img
				src="/icons/ln-highlight.svg"
				alt="protocol"
				class="mb-1 inline dark:rounded-full dark:bg-white dark:p-0.5"
			/>
		</p>

		<CopyButton value={invoice} />
	</div>

	<slot />
</div>
