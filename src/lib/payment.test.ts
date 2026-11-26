import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";
import api from "#lib/axios.js";
import { INVOICE_CHECK_TIMEOUT, POLLING_INTERVAL } from "#lib/constants.js";

import {
	classifyBoostError,
	fetchInvoice,
	fetchInvoicePaid,
	isInvoicePaid,
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

describe("fetchInvoice", () => {
	it("queries the invoice straight on the v4 API, id encoded", async () => {
		const { default: api } = await import("#lib/axios.js");
		await fetchInvoice("abc/123");
		expect(api.get).toHaveBeenCalledWith(
			`${API_BASE}/v4/invoices/abc%2F123`,
			expect.anything(),
		);
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

	it("hands the abort signal to the request", async () => {
		vi.mocked(api.get).mockResolvedValueOnce({ data: { status: "paid" } });
		const { signal } = new AbortController();
		await fetchInvoicePaid("inv", signal);
		expect(api.get).toHaveBeenLastCalledWith(expect.any(String), { signal });
	});
});

describe("pollUntilPaid", () => {
	const paid = { data: { status: "paid" } };
	const unpaid = { data: { status: "unpaid" } };
	const hanging = () => new Promise<never>(() => {});
	const signalOf = (call: number) =>
		vi.mocked(api.get).mock.calls[call]?.[1]?.signal;

	const setVisibility = (state: "visible" | "hidden") => {
		Object.defineProperty(document, "visibilityState", {
			value: state,
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(api.get).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		Object.defineProperty(document, "visibilityState", {
			value: "visible",
			configurable: true,
		});
	});

	// #1618: a phone user pays in the wallet app, the browser throttles the
	// backgrounded tab, and on return every queued check answered "paid" at
	// once, firing the success handler up to 51 times
	it("keeps one check in flight: a slow answer holds back the next one", async () => {
		vi.mocked(api.get).mockReturnValue(hanging());
		const stop = pollUntilPaid("inv", { onPaid: vi.fn() });

		await vi.advanceTimersByTimeAsync(
			POLLING_INTERVAL + INVOICE_CHECK_TIMEOUT - 1,
		);

		expect(api.get).toHaveBeenCalledTimes(1);
		stop();
	});

	// #1677: a check in flight when the phone switched to the wallet app can
	// stall for good, and with one check at a time it blocked every later one
	it("gives up on a check that hangs and checks afresh, one at a time", async () => {
		vi.mocked(api.get)
			.mockReturnValueOnce(hanging())
			.mockResolvedValueOnce(paid);
		const onPaid = vi.fn();
		const onCheckError = vi.fn();
		const stop = pollUntilPaid("inv", { onPaid, onCheckError });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL + INVOICE_CHECK_TIMEOUT);

		expect(api.get).toHaveBeenCalledTimes(2);
		expect(signalOf(0)?.aborted).toBe(true);
		expect(onPaid).toHaveBeenCalledTimes(1);
		// Abandoning a check is not a failure to report
		expect(onCheckError).not.toHaveBeenCalled();
		stop();
	});

	it("drops a late answer from a check it gave up on", async () => {
		let lateAnswer: (value: typeof paid) => void = () => {};
		vi.mocked(api.get)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					lateAnswer = resolve;
				}),
			)
			.mockResolvedValue(unpaid);
		const onPaid = vi.fn();
		const stop = pollUntilPaid("inv", { onPaid });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL + INVOICE_CHECK_TIMEOUT);
		lateAnswer(paid);
		await vi.advanceTimersByTimeAsync(0);

		expect(onPaid).not.toHaveBeenCalled();
		stop();
	});

	it("checks at once when the tab is visible again, replacing a hanging check", async () => {
		vi.mocked(api.get)
			.mockReturnValueOnce(hanging())
			.mockResolvedValueOnce(paid);
		const onPaid = vi.fn();
		const onCheckError = vi.fn();
		const stop = pollUntilPaid("inv", { onPaid, onCheckError });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		setVisibility("hidden");
		await vi.advanceTimersByTimeAsync(1000);
		expect(api.get).toHaveBeenCalledTimes(1);

		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(0);

		expect(api.get).toHaveBeenCalledTimes(2);
		expect(signalOf(0)?.aborted).toBe(true);
		expect(onPaid).toHaveBeenCalledTimes(1);
		expect(onCheckError).not.toHaveBeenCalled();
		stop();
	});

	it("checks at once when the tab is visible again, instead of on the timer", async () => {
		vi.mocked(api.get).mockResolvedValue(unpaid);
		const stop = pollUntilPaid("inv", { onPaid: vi.fn() });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		expect(api.get).toHaveBeenCalledTimes(1);

		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(0);
		expect(api.get).toHaveBeenCalledTimes(2);

		// The timer the first answer set is gone: the next check is an
		// interval after the visible one, not after the first
		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL - 1);
		expect(api.get).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(api.get).toHaveBeenCalledTimes(3);
		stop();
	});

	it("doesn't check when the tab is hidden", async () => {
		vi.mocked(api.get).mockResolvedValue(unpaid);
		const stop = pollUntilPaid("inv", { onPaid: vi.fn() });

		setVisibility("hidden");
		await vi.advanceTimersByTimeAsync(0);

		expect(api.get).not.toHaveBeenCalled();
		stop();
	});

	it("doesn't check or finish again when the tab is visible while onPaid runs", async () => {
		vi.mocked(api.get).mockResolvedValue(paid);
		const onPaid = vi.fn(() => new Promise<void>(() => {}));
		const stop = pollUntilPaid("inv", { onPaid });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(0);

		expect(api.get).toHaveBeenCalledTimes(1);
		expect(onPaid).toHaveBeenCalledTimes(1);
		stop();
	});

	it("doesn't check when the tab is visible after the flow finished", async () => {
		vi.mocked(api.get).mockResolvedValue(paid);
		pollUntilPaid("inv", { onPaid: vi.fn() });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(0);

		expect(api.get).toHaveBeenCalledTimes(1);
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

	it("stop() aborts the check in flight and stops listening to the tab", async () => {
		vi.mocked(api.get).mockReturnValue(hanging());
		const stop = pollUntilPaid("inv", { onPaid: vi.fn() });

		await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);
		stop();
		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(INVOICE_CHECK_TIMEOUT * 2);

		expect(signalOf(0)?.aborted).toBe(true);
		expect(api.get).toHaveBeenCalledTimes(1);
	});
});
