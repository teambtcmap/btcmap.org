// Shared payment utilities for comment and boost flows
import type { AxiosError } from "axios";

import api from "$lib/axios";

// Poll invoice status from v4 API
export const pollInvoiceStatus = async (invoiceId: string) => {
	return api.get(`/api/boost/invoice/status?invoice_id=${invoiceId}`);
};

// Check if invoice is paid
export const isInvoicePaid = (status: string) => {
	return status === "paid";
};

// Classify a failed boost request so the UI can explain the cause.
// A response with any status means our server answered and the failure is
// service-side; no response means the request never completed (the user is
// offline or it timed out).
export const classifyBoostError = (error: unknown): "network" | "service" => {
	return (error as AxiosError)?.response ? "service" : "network";
};
