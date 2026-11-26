// Shared payment utilities for comment and boost flows
import type { AxiosError } from "axios";

import { API_BASE } from "#lib/api-base.js";
import api from "#lib/axios.js";
import { INVOICE_CHECK_TIMEOUT, POLLING_INTERVAL } from "#lib/constants.js";

import type { Invoice } from "$types/btcmap-api/Invoice";

// Fetch the invoice straight from the v4 API — it answers CORS
// preflights, so no server proxy is involved (#1348).
export const fetchInvoice = async (invoiceId: string, signal?: AbortSignal) => {
	return api.get<Invoice>(
		`${API_BASE}/v4/invoices/${encodeURIComponent(invoiceId)}`,
		{ signal },
	);
};

// Check if invoice is paid
export const isInvoicePaid = (status: string) => {
	return status === "paid";
};

// One status check; a body without a status (non-JSON) counts as unpaid
export const fetchInvoicePaid = async (
	invoiceId: string,
	signal?: AbortSignal,
): Promise<boolean> => {
	const response = await fetchInvoice(invoiceId, signal);
	return isInvoicePaid(response.data?.status);
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
// flow up to 51 times (#1618).
// One at a time, a check that never answers would block every later one: a
// request in flight when the phone switched to the wallet app can stall once
// the browser freezes the tab (#1677). So a check that hasn't answered within
// INVOICE_CHECK_TIMEOUT is aborted, its answer dropped, and a fresh one
// starts; and coming back to the tab checks at once when no check is in
// flight. Returns stop(), after which nothing fires.
export const pollUntilPaid = (
	invoiceId: string,
	{ onPaid, onCheckError = () => {} }: PollUntilPaidOptions,
): (() => void) => {
	let stopped = false;
	// onPaid is running: no check may start, nor call it a second time
	let finishing = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// The check in flight; only its answer counts
	let inFlight: AbortController | undefined;
	// The tab was hidden while the check in flight ran: if it times out, the
	// frozen tab is the likely cause, not the API, and it isn't reported
	let hiddenDuringCheck = false;

	const dropInFlight = () => {
		inFlight?.abort();
		inFlight = undefined;
	};

	const scheduleCheck = () => {
		clearTimeout(timer);
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
		dropInFlight();
		const controller = new AbortController();
		inFlight = controller;
		hiddenDuringCheck = document.visibilityState === "hidden";
		const giveUpTimer = setTimeout(() => {
			if (inFlight !== controller) return;
			if (!hiddenDuringCheck) {
				reportCheckError(new Error("The invoice check timed out"));
			}
			check();
		}, INVOICE_CHECK_TIMEOUT);

		let paid = false;
		try {
			paid = await fetchInvoicePaid(invoiceId, controller.signal);
		} catch (error) {
			// A check given up on or stopped rejects as aborted: not news
			if (!stopped && inFlight === controller) reportCheckError(error);
		} finally {
			clearTimeout(giveUpTimer);
		}
		if (stopped || inFlight !== controller) return;
		inFlight = undefined;
		if (!paid) {
			scheduleCheck();
			return;
		}
		finishing = true;
		try {
			await onPaid();
			stop();
		} catch (error) {
			// Caught to retry, so it would otherwise vanish from the console
			console.error(
				"Finishing the paid invoice failed, checking again:",
				error,
			);
			scheduleCheck();
		} finally {
			finishing = false;
		}
	};

	// Back from the wallet app, the timer may have been throttled: check now.
	// A check still in flight is left to its give-up timer, which a long
	// freeze leaves overdue, so it fires as soon as the tab runs again: a
	// second request while the first may still be at the API could settle
	// the invoice twice there (it publishes the comment, or extends the
	// boost, while answering).
	const onVisibilityChange = () => {
		if (document.visibilityState === "hidden") {
			hiddenDuringCheck = true;
			return;
		}
		if (stopped || finishing || inFlight) return;
		clearTimeout(timer);
		check();
	};

	const stop = () => {
		stopped = true;
		clearTimeout(timer);
		dropInFlight();
		document.removeEventListener("visibilitychange", onVisibilityChange);
	};

	document.addEventListener("visibilitychange", onVisibilityChange);
	scheduleCheck();
	return stop;
};

// Classify a failed boost request so the UI can explain the cause.
// A response with any status means the API answered and the failure is
// service-side; no response means the request never completed (the user is
// offline or it timed out).
export const classifyBoostError = (error: unknown): "network" | "service" => {
	return (error as AxiosError)?.response ? "service" : "network";
};
