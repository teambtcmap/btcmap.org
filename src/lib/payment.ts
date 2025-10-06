/**
 * Shared payment utilities for comment and boost flows
 */
import axios from 'axios';
import axiosRetry from 'axios-retry';

/**
 * Create a configured axios instance for payment API calls
 */
export const createPaymentApi = () => {
	const api = axios.create();
	axiosRetry(api, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
	return api;
};

/**
 * Poll invoice status from v4 API
 */
export const pollInvoiceStatus = async (invoiceId: string) => {
	const api = createPaymentApi();
	return api.get(`https://api.btcmap.org/v4/invoices/${invoiceId}`);
};

/**
 * Check if invoice is paid
 */
export const isInvoicePaid = (status: string) => {
	return status === 'paid';
};
