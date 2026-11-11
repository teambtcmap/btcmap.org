// Shared payment utilities for comment and boost flows
import type { AxiosError } from "axios";

import { API_BASE } from "#lib/api-base.js";
import api from "#lib/axios.js";
import { POLLING_INTERVAL } from "#lib/constants.js";

import type { Invoice } from "$types/btcmap-api/Invoice";

// Poll invoice status straight from the v4 API — it answers CORS
// preflights, so no server proxy is involved (#1348).
export const pollInvoiceStatus = async (invoiceId: string) => {
	return api.get<Invoice>(
		`${API_BASE}/v4/invoices/${encodeURIComponent(invoiceId)}`,
	);
};

// Check if invoice is paid
export const isInvoicePaid = (status: string) => {
	return status === "paid";
};

type PollUntilPaidOptions = {
	// Finishes the payment flow. Resolving ends the polling; rejecting checks
	// again, so the next paid answer retries it (the boost flow re-verifies
	// the payment here).
	onPaid: () => void | Promise<void>;
	onCheckError?: (error: unknown) => void;
};

// Checks the invoice until it's paid, one request at a time: the next check
// is scheduled only once the previous answer is in. A timer per interval let
// checks pile up in a tab the browser throttled while the user paid in a
// wallet app, and on return they all answered "paid" at once, finishing the
// flow up to 51 times (#1618). Returns stop(), after which nothing fires.
export const pollUntilPaid = (
	invoiceId: string,
	{ onPaid, onCheckError = () => {} }: PollUntilPaidOptions,
): (() => void) => {
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const scheduleCheck = () => {
		if (!stopped) timer = setTimeout(check, POLLING_INTERVAL);
	};

	// A throwing handler must not end the polling: the next check never
	// gets scheduled and the error escapes as an unhandled rejection
	const reportCheckError = (error: unknown) => {
		try {
			onCheckError(error);
		} catch (handlerError) {
			console.error("Reporting a failed invoice check failed:", handlerError);
		}
	};

	const check = async () => {
		let paid = false;
		try {
			const response = await pollInvoiceStatus(invoiceId);
			paid = isInvoicePaid(response.data?.status);
		} catch (error) {
			if (!stopped) reportCheckError(error);
		}
		if (stopped) return;
		if (!paid) {
			scheduleCheck();
			return;
		}
		try {
			await onPaid();
			stopped = true;
		} catch (error) {
			// Caught to retry, so it would otherwise vanish from the console
			console.error(
				"Finishing the paid invoice failed, checking again:",
				error,
			);
			scheduleCheck();
		}
	};

	scheduleCheck();
	return () => {
		stopped = true;
		clearTimeout(timer);
	};
};

// Classify a failed boost request so the UI can explain the cause.
// A response with any status means the API answered and the failure is
// service-side; no response means the request never completed (the user is
// offline or it timed out).
export const classifyBoostError = (error: unknown): "network" | "service" => {
	return (error as AxiosError)?.response ? "service" : "network";
};
