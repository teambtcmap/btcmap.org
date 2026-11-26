import type { AxiosResponse } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import {
	GITEA_UNAVAILABLE_MESSAGE,
	isGiteaOutage,
	isSubmissionUnavailable,
} from "#lib/giteaOutage.js";

const answered = (status: number, data: unknown = {}) =>
	new AxiosError(
		`Request failed with status code ${status}`,
		"ERR_BAD_RESPONSE",
		undefined,
		undefined,
		{ status, data } as AxiosResponse,
	);

describe("isGiteaOutage", () => {
	it("is true for a Gitea that didn't answer", () => {
		expect(
			isGiteaOutage(new AxiosError("connect ECONNREFUSED", "ECONNREFUSED")),
		).toBe(true);
		expect(isGiteaOutage(new AxiosError("socket hang up", "ECONNRESET"))).toBe(
			true,
		);
	});

	it("is true for a proxy's 502 or 503 in front of a Gitea that isn't up", () => {
		expect(isGiteaOutage(answered(502))).toBe(true);
		expect(isGiteaOutage(answered(503))).toBe(true);
	});

	// Gitea may have saved the issue before these: a retry could file it twice
	it("is false for a timeout, a 500 or a 504", () => {
		expect(isGiteaOutage(new AxiosError("timeout", "ECONNABORTED"))).toBe(
			false,
		);
		expect(isGiteaOutage(answered(500))).toBe(false);
		expect(isGiteaOutage(answered(504))).toBe(false);
	});

	it("is false for a refused request or a failure that isn't Gitea's", () => {
		expect(isGiteaOutage(answered(422))).toBe(false);
		expect(isGiteaOutage(new Error("bug"))).toBe(false);
	});
});

describe("isSubmissionUnavailable", () => {
	it("is true for the issue route's 503 for a Gitea outage", () => {
		expect(
			isSubmissionUnavailable(
				answered(503, { message: GITEA_UNAVAILABLE_MESSAGE }),
			),
		).toBe(true);
	});

	// #1681: the route answers 503 for a misconfigured captcha key too, and
	// no retry in a minute fixes that
	it("is false for any other 503", () => {
		expect(
			isSubmissionUnavailable(
				answered(503, { message: "Service unavailable" }),
			),
		).toBe(false);
		expect(isSubmissionUnavailable(answered(503, "<html>"))).toBe(false);
	});

	it("is false for other statuses and for no answer", () => {
		expect(
			isSubmissionUnavailable(
				answered(500, { message: GITEA_UNAVAILABLE_MESSAGE }),
			),
		).toBe(false);
		expect(isSubmissionUnavailable(new AxiosError("offline"))).toBe(false);
		expect(isSubmissionUnavailable(undefined)).toBe(false);
	});
});
