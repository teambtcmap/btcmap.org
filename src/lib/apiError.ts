import { isAxiosError } from "axios";

import type { FailureStatus } from "#lib/analytics.js";

// The HTTP status of a failed btcmap-api call; undefined without an answer
// (network error, timeout, not an Axios error). Also what a failure may
// log: an Axios error carries the request config, so logging it whole
// would leak the Bearer token and any request body (passwords included).
export const errorStatus = (error: unknown): number | undefined =>
	isAxiosError(error) ? error.response?.status : undefined;

// What a funnel's *_failure event reports (#1575): the status the API
// answered with, "no_response" for a request that got none (offline,
// timeout), "client" for a failure before or without a request.
export const failureStatus = (error: unknown): FailureStatus => {
	if (!isAxiosError(error)) return "client";
	return error.response?.status ?? "no_response";
};
