import { isAxiosError } from "axios";

// The HTTP status of a failed btcmap-api call; undefined without an answer
// (network error, timeout, not an Axios error). Also what a failure may
// log: an Axios error carries the request config, so logging it whole
// would leak the Bearer token and any request body (passwords included).
export const errorStatus = (error: unknown): number | undefined =>
	isAxiosError(error) ? error.response?.status : undefined;

// A 2xx answer without the data the call needs: the server's fault, not
// the client's, for failureStatus
export class BadResponseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BadResponseError";
	}
}

// What a funnel's *_failure event reports (#1575): the status the API
// answered with, "no_response" for a request that got none (offline,
// timeout), "bad_response" for an answer of the wrong shape, "client" for
// a failure before or without a request. An event may add the refusals its
// own flow names (analytics.ts).
export type FailureStatus = number | "no_response" | "bad_response" | "client";

// null when there is nothing to report: the session the call was made for
// ended (logout, another login) before it went out. Matched by name, as
// authedApi.ts's SessionChangedError would pull the session into this leaf.
export const failureStatus = (error: unknown): FailureStatus | null => {
	if (error instanceof Error && error.name === "SessionChangedError") {
		return null;
	}
	if (error instanceof BadResponseError) return "bad_response";
	if (!isAxiosError(error)) return "client";
	return error.response?.status ?? "no_response";
};
