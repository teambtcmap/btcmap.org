<script lang="ts">
	import {
		CONFETTI_CANVAS_Z_INDEX,
		POLLING_INTERVAL,
		QR_CODE_SIZE,
		PAYMENT_ERROR_MESSAGE,
		BREAKPOINTS
	} from '$lib/constants';
	import { pollInvoiceStatus, isInvoicePaid } from '$lib/payment';
	import { errToast } from '$lib/utils';
	import JSConfetti from 'js-confetti';
	import { tick, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	export let invoice = '';
	export let invoiceId = '';
	export let onSuccess: () => void = () => {};
	export let onError: (error: unknown) => void = () => {};
	export let onStatusCheckError: (error: unknown) => void = () => {};

	let qr: HTMLCanvasElement;
	let polling = false;
	let pollInterval: ReturnType<typeof setInterval>;

	const jsConfetti = new JSConfetti();

	const generateQR = async () => {
		await tick();

		const QRCode = await import('qrcode');
		QRCode.default.toCanvas(
			qr,
			invoice,
			{ width: window.innerWidth > BREAKPOINTS.md ? QR_CODE_SIZE.desktop : QR_CODE_SIZE.mobile },
			function (error: Error | null | undefined) {
				if (error) {
					errToast(PAYMENT_ERROR_MESSAGE);
					console.error(error);
					onError(error);
				}
			}
		);
	};

	const checkInvoiceStatus = async () => {
		if (!invoiceId) return;

		try {
			const response = await pollInvoiceStatus(invoiceId);
			if (isInvoicePaid(response.data.status)) {
				polling = false;
				clearInterval(pollInterval);
				invalidateAll(); // Refresh UI immediately
				jsConfetti.addConfetti();
				onSuccess();
			}
		} catch (error) {
			console.error('Error checking invoice status:', error);
			onStatusCheckError(error);
		}
	};

	const startPolling = () => {
		polling = true;
		pollInterval = setInterval(checkInvoiceStatus, POLLING_INTERVAL);
	};

	const stopPolling = () => {
		if (pollInterval) {
			clearInterval(pollInterval);
			polling = false;
		}
	};

	// Generate QR when invoice changes
	$: if (invoice && qr) {
		generateQR();
	}

	// Start polling when invoiceId is set
	$: if (invoiceId && !polling) {
		startPolling();
	}

	// Set up confetti canvas z-index when QR canvas is ready
	$: if (qr) {
		const confettiCanvas = document.querySelector('canvas');
		if (confettiCanvas) {
			confettiCanvas.style.zIndex = CONFETTI_CANVAS_Z_INDEX;
		}
	}

	// Cleanup polling on component destroy
	onDestroy(() => {
		stopPolling();
	});
</script>

<canvas
	class="mx-auto h-[200px] w-[200px] rounded-2xl border-2 border-gray-300 transition-colors hover:border-link md:h-[275px] md:w-[275px] dark:border-white/95"
	bind:this={qr}
/>
