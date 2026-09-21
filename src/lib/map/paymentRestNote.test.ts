import { describe, expect, it } from "vitest";

import { shouldShowPaymentRestNote } from "./paymentRestNote";

// #1427. Both resting surfaces — the mobile peek and the desktop floating
// bar — ask the same question, so the answer lives in one place.
describe("shouldShowPaymentRestNote", () => {
	const empty = {
		behavior: "local-markers" as const,
		isLoading: false,
		hasError: false,
		merchantCount: 0,
		totalCount: 0,
		unknownPaymentCount: 2,
	};

	it("shows when the filter emptied the view and something is unchecked", () => {
		expect(shouldShowPaymentRestNote(empty)).toBe(true);
	});

	it("stays quiet while the view has results", () => {
		// #1424 rejected a standing tally on every filtered view: to a visitor
		// looking for somewhere to spend, it is noise.
		expect(
			shouldShowPaymentRestNote({ ...empty, merchantCount: 1, totalCount: 1 }),
		).toBe(false);
	});

	it("stays quiet when the view is empty for some other reason", () => {
		// Nothing was excluded for lack of evidence, so "nobody checked" would
		// be a different lie from the one it replaces.
		expect(
			shouldShowPaymentRestNote({ ...empty, unknownPaymentCount: 0 }),
		).toBe(false);
	});

	it("stays quiet while the list is still loading", () => {
		expect(shouldShowPaymentRestNote({ ...empty, isLoading: true })).toBe(
			false,
		);
	});

	it("stays quiet below the zoom floor", () => {
		// "none" means the list isn't even asking yet; an empty view there says
		// nothing about payment tags.
		expect(shouldShowPaymentRestNote({ ...empty, behavior: "none" })).toBe(
			false,
		);
	});

	it("stays quiet on an errored list", () => {
		expect(shouldShowPaymentRestNote({ ...empty, hasError: true })).toBe(false);
	});

	it("stays quiet when the viewport is too dense to list", () => {
		// merchantCount 0 with totalCount > 0 is "too-dense", not "empty":
		// there are places here, the list just refused to enumerate them.
		expect(shouldShowPaymentRestNote({ ...empty, totalCount: 40 })).toBe(false);
	});
});
