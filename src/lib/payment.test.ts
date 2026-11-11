import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";
import api from "#lib/axios.js";
import { POLLING_INTERVAL } from "#lib/constants.js";

import {
	classifyBoostError,
	fetchInvoicePaid,
	isInvoicePaid,
	pollInvoiceStatus,
	pollUntilPaid,
} from "./payment";

vi.mock("#lib/axios.js", () => ({
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
		const { default: api } = await import("#lib/axios.js");
		await pollInvoiceStatus("abc/123");
		expect(api.get).toHaveBeenCalledWith(`${API_BASE}/v4/invoices/abc%2F123`);
	});
});

describe("fetchInvoicePaid", () => {
	it("is true for a paid invoice", async () => {
		vi.mocked(api.get).mockResolvedValueOnce({ data: { status: "paid" } });
		await expect(fetchInvoicePaid("inv")).resolves.toBe(true);
	});

	it("is false for an unpaid invoice", async () => {
		vi.mocked(api.get).mockResolvedValueOnce({ data: { status: "unpaid" } });
		await expect(fetchInvoicePaid("inv")).resolves.toBe(false);
	});

	// A non-JSON body (an HTML error page, a stray "\n") has no status
	it("is false for a body without a status", async () => {
		vi.mocked(api.get).mockResolvedValueOnce({ data: "\n" });
		await expect(fetchInvoicePaid("inv")).resolves.toBe(false);
	});

	it("rejects when the request fails", async () => {
		const failure = new Error("offline");
		vi.mocked(api.get).mockRejectedValueOnce(failure);
		await expect(fetchInvoicePaid("inv")).rejects.toBe(failure);
	});
});

describe("pollUntilPaid", () => {
	const paid = { data: { status: "paid" } };
	const unpaid = { data: { status: "unpaid" } };

	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(api.get).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// #1618: a phone user pays in the wallet app, the browser throttles the
	// backgrounded tab, and on return every queued check answered "paid" at
	// once, firing the success handler up to 51 times
	it("keeps one check in flight: a slow answer holds back the next one", async () => {
		vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
		const stop = pollUntilPaid("inv", { onPaid: vi.fn() });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 10);

		expect(api.get).toHaveBeenCalledTimes(1);
		stop();
	});

	it("calls onPaid once for a paid answer and stops checking", async () => {
		vi.mocked(api.get).mockResolvedValue(paid);
		const onPaid = vi.fn();
		pollUntilPaid("inv", { onPaid });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 10);

		expect(onPaid).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledTimes(1);
	});

	it("checks again an interval after an unpaid answer", async () => {
		vi.mocked(api.get)
			.mockResolvedValueOnce(unpaid)
			.mockResolvedValueOnce(paid);
		const onPaid = vi.fn();
		pollUntilPaid("inv", { onPaid });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(onPaid).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		expect(api.get).toHaveBeenCalledTimes(2);
		expect(onPaid).toHaveBeenCalledTimes(1);
	});

	it("reports a failed check and keeps checking", async () => {
		const failure = new Error("offline");
		vi.mocked(api.get)
			.mockRejectedValueOnce(failure)
			.mockResolvedValueOnce(paid);
		const onPaid = vi.fn();
		const onCheckError = vi.fn();
		pollUntilPaid("inv", { onPaid, onCheckError });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 2);

		expect(onCheckError).toHaveBeenCalledExactlyOnceWith(failure);
		expect(onPaid).toHaveBeenCalledTimes(1);
	});

	it("keeps checking when onCheckError throws", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const thrown = new Error("toast failed");
		vi.mocked(api.get)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(paid);
		const onPaid = vi.fn();
		const onCheckError = vi.fn(() => {
			throw thrown;
		});
		pollUntilPaid("inv", { onPaid, onCheckError });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 2);

		expect(onPaid).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(expect.any(String), thrown);
		log.mockRestore();
	});

	// The boost flow re-verifies the payment in onPaid; a transient failure
	// there must be retried on the next paid answer, not wedge the flow
	it("checks again when onPaid rejects, so the next paid answer retries it", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const failure = new Error("finalize");
		vi.mocked(api.get).mockResolvedValue(paid);
		const onPaid = vi
			.fn()
			.mockRejectedValueOnce(failure)
			.mockResolvedValueOnce(undefined);
		pollUntilPaid("inv", { onPaid });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 10);

		expect(onPaid).toHaveBeenCalledTimes(2);
		expect(api.get).toHaveBeenCalledTimes(2);
		// The rejection is caught to retry, so it would vanish without the log
		expect(log).toHaveBeenCalledWith(expect.any(String), failure);
		log.mockRestore();
	});

	it("waits for a slow onPaid: no new check and no second call meanwhile", async () => {
		vi.mocked(api.get).mockResolvedValue(paid);
		let finish = () => {};
		const onPaid = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		pollUntilPaid("inv", { onPaid });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 10);
		expect(onPaid).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledTimes(1);

		finish();
		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 10);
		expect(onPaid).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledTimes(1);
	});

	it("ignores an answer that arrives after stop()", async () => {
		let answer: (value: typeof paid) => void = () => {};
		vi.mocked(api.get).mockReturnValue(
			new Promise((resolve) => {
				answer = resolve;
			}),
		);
		const onPaid = vi.fn();
		const onCheckError = vi.fn();
		const stop = pollUntilPaid("inv", { onPaid, onCheckError });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		stop();
		answer(paid);
		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 10);

		expect(onPaid).not.toHaveBeenCalled();
		expect(api.get).toHaveBeenCalledTimes(1);
	});

	it("stop() cancels the next scheduled check", async () => {
		vi.mocked(api.get).mockResolvedValue(unpaid);
		const stop = pollUntilPaid("inv", { onPaid: vi.fn() });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		stop();
		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL * 10);

		expect(api.get).toHaveBeenCalledTimes(1);
	});
});
