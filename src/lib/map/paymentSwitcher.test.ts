import { describe, expect, it } from "vitest";

import { activePaymentOption, paymentSwitchUrl } from "./paymentSwitcher";

// #1430. Single-select, because applyPaymentMethodFilter ANDs its methods:
// a second selection narrows the set rather than widening it, so a tap has
// to REPLACE the current param, never append to it.
describe("activePaymentOption", () => {
	const params = (search: string) => new URLSearchParams(search);

	it("reads the one selected method", () => {
		expect(activePaymentOption(params("?lightning"))).toBe("lightning");
		expect(activePaymentOption(params("?onchain"))).toBe("onchain");
		expect(activePaymentOption(params("?nfc"))).toBe("nfc");
	});

	it("reads a bare param and an empty-valued one alike", () => {
		// parsePaymentMethodsParam uses has(), so both forms are live in the
		// wild; the switcher must agree with the filter about what is active.
		expect(activePaymentOption(params("?lightning="))).toBe("lightning");
	});

	it("reports none on an unfiltered view", () => {
		expect(activePaymentOption(params(""))).toBeNull();
		expect(activePaymentOption(params("?issues"))).toBeNull();
	});

	it("reports none on a hand-written multi-param URL", () => {
		// No single option describes ?lightning&onchain, and rewriting the
		// URL on load would silently change an embed's meaning. Render
		// nothing active; the first tap collapses it to one method.
		expect(activePaymentOption(params("?lightning&onchain"))).toBeNull();
		expect(activePaymentOption(params("?onchain&lightning&nfc"))).toBeNull();
	});

	it("ignores unrelated params", () => {
		expect(activePaymentOption(params("?lightning&boosts=true"))).toBe(
			"lightning",
		);
	});
});

describe("paymentSwitchUrl", () => {
	const HERE = "https://btcmap.org/map?lightning#17/42.27/42.70";

	it("replaces the current method rather than appending", () => {
		expect(paymentSwitchUrl(HERE, "onchain")).toBe(
			"https://btcmap.org/map?onchain#17/42.27/42.70",
		);
	});

	it("collapses a multi-param URL to the tapped method", () => {
		expect(
			paymentSwitchUrl("https://btcmap.org/map?lightning&onchain", "nfc"),
		).toBe("https://btcmap.org/map?nfc");
	});

	it("drops every payment param for All places", () => {
		expect(paymentSwitchUrl(HERE, null)).toBe(
			"https://btcmap.org/map#17/42.27/42.70",
		);
		expect(
			paymentSwitchUrl("https://btcmap.org/map?onchain&lightning&nfc", null),
		).toBe("https://btcmap.org/map");
	});

	it("writes a bare param, not method=", () => {
		// The Embedding contract documents ?lightning; URLSearchParams.set
		// would write ?lightning=, which works but rewrites every operator's
		// URL the first time someone taps.
		expect(paymentSwitchUrl("https://btcmap.org/map", "lightning")).toBe(
			"https://btcmap.org/map?lightning",
		);
	});

	it("keeps unrelated params and the hash", () => {
		expect(
			paymentSwitchUrl(
				"https://btcmap.org/map?boosts=true&lightning#17/1/2",
				"nfc",
			),
		).toBe("https://btcmap.org/map?boosts=true&nfc#17/1/2");
	});

	it("keeps unrelated params when clearing", () => {
		expect(
			paymentSwitchUrl("https://btcmap.org/map?lightning&issues", null),
		).toBe("https://btcmap.org/map?issues");
	});
});
