// Shared payment utilities for comment and boost flows
import api from "$lib/axios";

// Poll invoice status from v4 API
export const pollInvoiceStatus = async (invoiceId: string) => {
	return api.get(`/api/boost/invoice/status?invoice_id=${invoiceId}`);
};

// Check if invoice is paid
export const isInvoicePaid = (status: string) => {
	return status === "paid";
};
