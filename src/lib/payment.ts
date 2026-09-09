// Shared payment utilities for comment and boost flows
import type { AxiosError } from "axios";

import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";

// Poll invoice status straight from the v4 API — it answers CORS
// preflights, so no server proxy is involved (#1348).
export const pollInvoiceStatus = async (invoiceId: string) => {
	return api.get(`${API_BASE}/v4/invoices/${encodeURIComponent(invoiceId)}`);
};

// Check if invoice is paid
export const isInvoicePaid = (status: string) => {
	return status === "paid";
};

// Classify a failed boost request so the UI can explain the cause.
// A response with any status means the API answered and the failure is
// service-side; no response means the request never completed (the user is
// offline or it timed out).
export const classifyBoostError = (error: unknown): "network" | "service" => {
	return (error as AxiosError)?.response ? "service" : "network";
};
