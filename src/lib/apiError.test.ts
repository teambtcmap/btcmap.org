import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { SessionChangedError } from "#lib/authedApi.js";

import { BadResponseError, errorStatus, failureStatus } from "./apiError";

const apiError = (status: number) =>
	new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
		status,
		statusText: "",
		data: { code: "conflict", message: "username already taken" },
		headers: {},
		config: { headers: new AxiosHeaders() },
	});

describe("errorStatus", () => {
	it("is the status of an API answer", () => {
		expect(errorStatus(apiError(409))).toBe(409);
		expect(errorStatus(apiError(500))).toBe(500);
	});

	it("is undefined without an answer", () => {
		expect(errorStatus(new AxiosError("Network Error"))).toBeUndefined();
		expect(errorStatus(new Error("offline"))).toBeUndefined();
		expect(errorStatus("boom")).toBeUndefined();
	});
});

describe("failureStatus", () => {
	it("is the status of an API answer", () => {
		expect(failureStatus(apiError(409))).toBe(409);
	});

	it("tells a request without an answer from a failure before one", () => {
		expect(failureStatus(new AxiosError("Network Error"))).toBe("no_response");
		expect(failureStatus(new Error("bad file"))).toBe("client");
		expect(failureStatus("user rejected")).toBe("client");
	});

	// A 2xx without the data the call needs is the server's fault
	it("is bad_response for an answer of the wrong shape", () => {
		expect(failureStatus(new BadResponseError("no token"))).toBe(
			"bad_response",
		);
	});

	// A logout or another login while the call ran: nothing failed for the
	// user who started it
	it("is null once the session the call was made for has ended", () => {
		expect(failureStatus(new SessionChangedError())).toBeNull();
	});
});
