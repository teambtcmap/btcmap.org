import { isAxiosError } from "axios";

// The HTTP status of a failed btcmap-api call; undefined without an answer
// (network error, timeout, not an Axios error). Also what a failure may
// log: an Axios error carries the request config, so logging it whole
// would leak the Bearer token and any request body (passwords included).
export const errorStatus = (error: unknown): number | undefined =>
	isAxiosError(error) ? error.response?.status : undefined;
