<script lang="ts">
import JSConfetti from "js-confetti";
import { tick } from "svelte";

import {
	BREAKPOINTS,
	CONFETTI_CANVAS_Z_INDEX,
	QR_CODE_SIZE,
} from "#lib/constants.js";
import { _ } from "#lib/i18n/index.js";
import { pollUntilPaid } from "#lib/payment.js";
import { errToast } from "#lib/utils.js";

import { refreshAll } from "$app/navigation";

type Props = {
	invoice?: string;
	invoiceId?: string;
	// Rejecting makes the poller check again and retry on its next paid answer
	onSuccess?: () => void | Promise<void>;
	onError?: (error: unknown) => void;
	onStatusCheckError?: (error: unknown) => void;
};
let {
	invoice = "",
	invoiceId = "",
	onSuccess = () => {},
	onError = () => {},
	onStatusCheckError = () => {},
}: Props = $props();

let qr = $state<HTMLCanvasElement>();

const jsConfetti = new JSConfetti();

const generateQR = async (canvas: HTMLCanvasElement, value: string) => {
	await tick();

	try {
		const QRCode = await import("qrcode");
		QRCode.default.toCanvas(
			canvas,
			value,
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

const liftConfettiCanvas = () => {
	const confettiCanvas =
		document.querySelector<HTMLCanvasElement>("body > canvas");
	if (confettiCanvas) {
		confettiCanvas.style.zIndex = CONFETTI_CANVAS_Z_INDEX;
	}
};

// Generate QR when invoice changes
$effect(() => {
	if (invoice && qr) generateQR(qr, invoice);
});

// One poller per invoice: a new id replaces the previous one's, and
// unmounting stops it. After that nothing fires, not even for a paid
// answer still in flight when the modal closed.
$effect(() => {
	if (!invoiceId) return;
	// A rejected onSuccess (the boost re-verify) retries on the next paid
	// answer; the refresh and confetti belong to the payment, once
	let celebrated = false;
	return pollUntilPaid(invoiceId, {
		onPaid: async () => {
			if (!celebrated) {
				celebrated = true;
				refreshAll(); // Refresh UI immediately
				jsConfetti.addConfetti();
				liftConfettiCanvas();
			}
			await onSuccess();
		},
		onCheckError: (error) => {
			console.error("Error checking invoice status:", error);
			onStatusCheckError(error);
		},
	});
});
</script>

<canvas
	class="mx-auto h-[200px] w-[200px] rounded-2xl border-2 border-gray-300 transition-colors hover:border-link md:h-[275px] md:w-[275px] dark:border-white/95"
	bind:this={qr}
></canvas>
