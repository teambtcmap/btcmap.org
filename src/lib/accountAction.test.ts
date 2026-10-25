import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAccountAction } from "./accountAction.svelte";

vi.mock("#lib/utils.js", () => ({ errToast: vi.fn() }));

const apiError = (status: number) =>
	new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
		status,
		statusText: "",
		data: {},
		headers: {},
		config: { headers: new AxiosHeaders({ Authorization: "Bearer tok" }) },
	});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createAccountAction", () => {
	it("is pending while the body runs, and not after", async () => {
		const action = createAccountAction("Rename");
		let resolve = () => {};
		const run = action.run(
			"error",
			() => new Promise<void>((r) => (resolve = r)),
		);

		expect(action.pending).toBe(true);
		resolve();
		await run;
		expect(action.pending).toBe(false);
	});

	it("ignores a second run while one is pending", async () => {
		const action = createAccountAction("Rename");
		const body = vi.fn(() => new Promise<void>(() => {}));

		void action.run("error", body);
		void action.run("error", body);

		expect(body).toHaveBeenCalledOnce();
	});

	it("toasts the message and logs only the status on failure", async () => {
		const { errToast } = await import("#lib/utils.js");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const action = createAccountAction("Rename");

		await action.run("Couldn't rename", () => Promise.reject(apiError(500)));

		expect(errToast).toHaveBeenCalledWith("Couldn't rename");
		expect(errorSpy).toHaveBeenCalledWith("Rename failed:", 500);
		expect(action.pending).toBe(false);
	});

	it("hands a failure's status to the caller's failure event", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const onFailure = vi.fn();
		const action = createAccountAction("Rename");

		await action.run("error", () => Promise.reject(apiError(500)), onFailure);
		await action.run("error", () => Promise.reject(new Error("x")), onFailure);
		await action.run("error", async () => {}, onFailure);

		expect(onFailure.mock.calls).toEqual([[500], ["client"]]);
	});

	it("reports no failure for a call whose session ended", async () => {
		const { SessionChangedError } = await import("#lib/authedApi.js");
		vi.spyOn(console, "error").mockImplementation(() => {});
		const onFailure = vi.fn();
		const action = createAccountAction("Rename");

		await action.run(
			"error",
			() => Promise.reject(new SessionChangedError()),
			onFailure,
		);

		expect(onFailure).not.toHaveBeenCalled();
	});

	it("logs unknown for an error without a status", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const action = createAccountAction("Unlink");

		await action.run("error", () => Promise.reject(new Error("offline")));

		expect(errorSpy).toHaveBeenCalledWith("Unlink failed:", "unknown");
	});

	it("doesn't toast on success", async () => {
		const { errToast } = await import("#lib/utils.js");
		const action = createAccountAction("Rename");

		await action.run("error", async () => {});

		expect(errToast).not.toHaveBeenCalled();
	});
});
