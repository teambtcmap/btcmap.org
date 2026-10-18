import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { errorStatus } from "./apiError";

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
