import { describe, expect, it, vi } from "vitest";

import { API_BASE } from "$lib/api-base";

import {
	classifyBoostError,
	isInvoicePaid,
	pollInvoiceStatus,
} from "./payment";

vi.mock("$lib/axios", () => ({
	default: { get: vi.fn(async () => ({ data: { status: "paid" } })) },
}));

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

describe("pollInvoiceStatus", () => {
	it("queries the invoice straight on the v4 API, id encoded", async () => {
		const { default: api } = await import("$lib/axios");
		await pollInvoiceStatus("abc/123");
		expect(api.get).toHaveBeenCalledWith(`${API_BASE}/v4/invoices/abc%2F123`);
	});
});
