<script lang="ts">
import JSConfetti from "js-confetti";
import { onDestroy, tick } from "svelte";

import {
	BREAKPOINTS,
	CONFETTI_CANVAS_Z_INDEX,
	QR_CODE_SIZE,
} from "#lib/constants.js";
import { _ } from "#lib/i18n/index.js";
import { pollUntilPaid } from "#lib/payment.js";
import { errToast } from "#lib/utils.js";

import { refreshAll } from "$app/navigation";

export let invoice = "";
export let invoiceId = "";
// Rejecting makes the poller check again and retry on its next paid answer
export let onSuccess: () => void | Promise<void> = () => {};
export let onError: (error: unknown) => void = () => {};
export let onStatusCheckError: (error: unknown) => void = () => {};

let qr: HTMLCanvasElement;
let stopPolling = () => {};

const jsConfetti = new JSConfetti();

const generateQR = async () => {
	await tick();

	try {
		const QRCode = await import("qrcode");
		QRCode.default.toCanvas(
			qr,
			invoice,
			{
				width:
					window.innerWidth > BREAKPOINTS.md
						? QR_CODE_SIZE.desktop
						: QR_CODE_SIZE.mobile,
			},
			(error: Error | null | undefined) => {
				if (error) {
					errToast($_("supporters.qrLoadError"));
					console.error(error);
					onError(error);
				}
			},
		);
	} catch (error) {
		errToast($_("supporters.qrLoadError"));
		console.error("Failed to load QRCode module:", error);
		onError(error);
	}
};

// One poller per invoice: a new id replaces the previous one's
const startPolling = (id: string) => {
	stopPolling();
	stopPolling = id
		? pollUntilPaid(id, {
				onPaid: async () => {
					refreshAll(); // Refresh UI immediately
					jsConfetti.addConfetti();
					liftConfettiCanvas();
					await onSuccess();
				},
				onCheckError: (error) => {
					console.error("Error checking invoice status:", error);
					onStatusCheckError(error);
				},
			})
		: () => {};
};

// Generate QR when invoice changes
$: if (invoice && qr) {
	generateQR();
}

$: startPolling(invoiceId);

const liftConfettiCanvas = () => {
	const confettiCanvas =
		document.querySelector<HTMLCanvasElement>("body > canvas");
	if (confettiCanvas) {
		confettiCanvas.style.zIndex = CONFETTI_CANVAS_Z_INDEX;
	}
};

// Cleanup polling on component destroy
onDestroy(() => {
	stopPolling();
});
</script>

<canvas
	class="mx-auto h-[200px] w-[200px] rounded-2xl border-2 border-gray-300 transition-colors hover:border-link md:h-[275px] md:w-[275px] dark:border-white/95"
	bind:this={qr}
></canvas>
