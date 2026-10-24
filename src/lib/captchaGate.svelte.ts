import axios, { isAxiosError } from "axios";

// The captcha the public forms send with a submission (add-location's
// anonymous path, verify-location, add community, verify community):
// fetching an image, holding its secret, and replacing both when they can
// no longer pass. CaptchaField renders it.
//
// The server burns a secret on its first correct answer, before the
// submission behind it can fail (lib/server/captcha.ts, #1401). After a
// failed submit, whatever the reason, the secret may be spent and a retry
// with it could only come back "already used": submitFailed() swaps in a
// fresh one.

type CaptchaResponse = { captcha: string; captchaSecret: string };

type Options = {
	// The image couldn't be loaded; the form toasts in its own words
	onfetcherror: () => void;
	// A new image is on its way: the answer typed for the old one is void
	onnewimage?: () => void;
	// A form that fetches on mount starts out loading: the field shows its
	// placeholder until the first image is in, server render included
	// (CaptchaField's sanitizer only runs in the browser)
	loading?: boolean;
};

export const createCaptchaGate = ({
	onfetcherror,
	onnewimage,
	loading: initiallyLoading = false,
}: Options) => {
	let secret = $state<string>();
	let content = $state("");
	let loading = $state(initiallyLoading);
	// A refresh started while another is in flight wins; the older answer
	// is dropped
	let generation = 0;

	const refresh = () => {
		const run = ++generation;
		secret = undefined;
		loading = true;
		onnewimage?.();
		axios
			.get<CaptchaResponse>("/captcha")
			.then((response) => {
				if (run !== generation) return;
				secret = response.data.captchaSecret;
				content = response.data.captcha;
			})
			.catch((error: unknown) => {
				if (run !== generation) return;
				onfetcherror();
				console.error("captcha: fetch failed", error);
			})
			.finally(() => {
				if (run === generation) loading = false;
			});
	};

	return {
		// The secret to send with the answer; undefined until an image is in
		get secret() {
			return secret;
		},
		get content() {
			return content;
		},
		get loading() {
			return loading;
		},
		refresh,
		submitFailed: refresh,
	};
};

// The server's words for a refused captcha (wrong answer, already used),
// written for users; undefined for any other failure, including one with no
// response at all (offline, timeout).
export const captchaRejection = (error: unknown): string | undefined => {
	if (!isAxiosError(error) || error.response?.status !== 400) return undefined;
	const message = (error.response.data as { message?: unknown } | undefined)
		?.message;
	return typeof message === "string" && message.includes("Captcha")
		? message
		: undefined;
};
