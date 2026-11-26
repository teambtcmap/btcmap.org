import { isAxiosError } from "axios";

// What /api/gitea/issue answers, with a 503, while Gitea is down (#1681).
// The forms match this message, not the status alone: the route answers
// 503 for a misconfigured captcha key too, and no retry fixes that.
export const GITEA_UNAVAILABLE_MESSAGE =
	"The ticket system is unavailable, try again in a minute";

// Server side: a Gitea call that failed before Gitea could act on it, so
// filing again later can't file twice. No answer at all (refused, reset,
// unknown host), or a proxy's 502/503 for a Gitea that isn't up. A timeout,
// a 500 or a 504 may come after Gitea saved the issue: those stay errors.
export const isGiteaOutage = (error: unknown): boolean => {
	if (!isAxiosError(error)) return false;
	if (!error.response) return error.code !== "ECONNABORTED";
	return error.response.status === 502 || error.response.status === 503;
};

// Client side: the issue route reported that outage, so the same submission
// will go through once Gitea is back
export const isSubmissionUnavailable = (error: unknown): boolean => {
	if (!isAxiosError(error) || error.response?.status !== 503) return false;
	const data = error.response.data as { message?: unknown } | undefined;
	return data?.message === GITEA_UNAVAILABLE_MESSAGE;
};
