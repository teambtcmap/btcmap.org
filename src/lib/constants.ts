/**
 * Shared constants used across the application
 */

/**
 * Z-index value for js-confetti canvas to ensure it appears above modals
 * Used in payment success celebrations (boost and comment flows)
 */
export const CONFETTI_CANVAS_Z_INDEX = '2001';

/**
 * Payment-related constants shared between comment and boost flows
 */
export const POLLING_INTERVAL = 2500;
export const QR_CODE_SIZE = { mobile: 200, desktop: 275 };
export const PAYMENT_ERROR_MESSAGE =
	'Could not generate invoice, please try again or contact BTC Map.';
export const STATUS_CHECK_ERROR_MESSAGE =
	'Could not check invoice status, please try again or contact BTC Map.';
