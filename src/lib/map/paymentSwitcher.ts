import type { PaymentMethod } from "./paymentMethodFilter";
import { PAYMENT_METHODS } from "./paymentMethodFilter";

// The payment switcher's reducer (#1430). Single-select on purpose:
// applyPaymentMethodFilter ANDs the selected methods, so a second param
// narrows the set rather than widening it. A row that appended would do
// the opposite of what it looks like on an already-empty view.

// Which option the current URL describes, or null when none does.
// `parsePaymentMethodsParam` matches on has(), so `?lightning` and
// `?lightning=` are both live in the wild and both count here — the
// switcher must agree with the filter about what is active.
export const activePaymentOption = (
	params: URLSearchParams,
): PaymentMethod | null => {
	const selected = PAYMENT_METHODS.filter((method) => params.has(method));
	// A hand-written ?lightning&onchain is a real AND filter that no single
	// option describes. Mark nothing active rather than picking one — and
	// never rewrite it on load, which would silently change what an
	// operator's embed shows.
	return selected.length === 1 ? selected[0] : null;
};

// The URL a tap navigates to: the chosen method alone, or none of them for
// "All places". Everything else — other params, the viewport hash — is
// carried over untouched.
export const paymentSwitchUrl = (
	href: string,
	method: PaymentMethod | null,
): string => {
	const url = new URL(href);
	// The query is edited as raw tokens, not through URLSearchParams: its
	// toString() re-serializes every bare flag, so round-tripping would
	// rewrite ?issues to ?issues= and ?lightning to ?lightning=. The
	// Embedding contract documents the bare forms, and a switcher tap has
	// no business rewriting params it was not asked about.
	const kept = url.search
		.replace(/^\?/, "")
		.split("&")
		.filter(Boolean)
		.filter((token) => {
			const raw = token.split("=")[0];
			let key: string;
			try {
				key = decodeURIComponent(raw);
			} catch {
				// A malformed escape (`?lightning&%`) is still a legal URL, and
				// decodeURIComponent throws on it. It is certainly not one of
				// our three keys, so keep it verbatim rather than letting an
				// unrelated token break every tap.
				key = raw;
			}
			return !(PAYMENT_METHODS as readonly string[]).includes(key);
		});
	if (method) kept.push(method);
	const search = kept.length > 0 ? `?${kept.join("&")}` : "";
	return `${url.origin}${url.pathname}${search}${url.hash}`;
};
