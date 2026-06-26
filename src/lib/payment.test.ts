import { describe, expect, it } from "vitest";

import { classifyBoostError, isInvoicePaid } from "./payment";

describe("classifyBoostError", () => {
	it("returns 'service' when the server responded with an error status", () => {
		expect(classifyBoostError({ response: { status: 400 } })).toBe("service");
		expect(classifyBoostError({ response: { status: 403 } })).toBe("service");
		expect(classifyBoostError({ response: { status: 502 } })).toBe("service");
	});

	it("returns 'network' when there is no response (offline or timeout)", () => {
		expect(classifyBoostError({ code: "ERR_NETWORK" })).toBe("network");
		expect(classifyBoostError({ code: "ECONNABORTED" })).toBe("network");
		expect(classifyBoostError(new Error("boom"))).toBe("network");
		expect(classifyBoostError(undefined)).toBe("network");
		expect(classifyBoostError(null)).toBe("network");
	});
});

describe("isInvoicePaid", () => {
	it("is true only for the exact 'paid' status", () => {
		expect(isInvoicePaid("paid")).toBe(true);
		expect(isInvoicePaid("pending")).toBe(false);
		expect(isInvoicePaid("")).toBe(false);
	});
});
