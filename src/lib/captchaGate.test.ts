import axios, { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captchaRejection, createCaptchaGate } from "./captchaGate.svelte";

vi.mock("axios", async (importOriginal) => {
	const actual = await importOriginal<typeof import("axios")>();
	return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

const image = (n: number) => ({
	data: { captcha: `<svg>${n}</svg>`, captchaSecret: `secret-${n}` },
});

const flush = () => new Promise((resolve) => setTimeout(resolve));

// What the form endpoints send: SvelteKit's error(status, message)
const failure = (status: number, message?: string) =>
	new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
		status,
		statusText: "",
		data: message === undefined ? {} : { message },
		headers: {},
		config: { headers: new AxiosHeaders() },
	});

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createCaptchaGate", () => {
	it("loads an image and its secret", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce(image(1));
		const gate = createCaptchaGate({ onfetcherror: vi.fn() });

		gate.refresh();
		expect(gate.loading).toBe(true);
		expect(gate.secret).toBeUndefined();
		await flush();

		expect(axios.get).toHaveBeenCalledWith("/captcha");
		expect(gate.loading).toBe(false);
		expect(gate.secret).toBe("secret-1");
		expect(gate.content).toBe("<svg>1</svg>");
	});

	// The server burns a secret before the submission behind it can fail:
	// resending it could only come back "already used"
	it("replaces the secret after a failed submit, voiding the typed answer", async () => {
		vi.mocked(axios.get)
			.mockResolvedValueOnce(image(1))
			.mockResolvedValueOnce(image(2));
		const onnewimage = vi.fn();
		const gate = createCaptchaGate({ onfetcherror: vi.fn(), onnewimage });
		gate.refresh();
		await flush();

		gate.submitFailed();
		expect(gate.secret).toBeUndefined();
		await flush();

		expect(gate.secret).toBe("secret-2");
		expect(onnewimage).toHaveBeenCalledTimes(2);
	});

	it("reports a failed fetch and leaves no secret", async () => {
		vi.mocked(axios.get).mockRejectedValueOnce(new Error("offline"));
		const onfetcherror = vi.fn();
		const gate = createCaptchaGate({ onfetcherror });

		gate.refresh();
		await flush();

		expect(onfetcherror).toHaveBeenCalledOnce();
		expect(gate.secret).toBeUndefined();
		expect(gate.loading).toBe(false);
	});

	it("keeps the newest of two overlapping fetches", async () => {
		let first: (value: unknown) => void = () => {};
		vi.mocked(axios.get)
			.mockImplementationOnce(() => new Promise((r) => (first = r)))
			.mockResolvedValueOnce(image(2));
		const gate = createCaptchaGate({ onfetcherror: vi.fn() });

		gate.refresh();
		gate.refresh();
		await flush();
		first(image(1));
		await flush();

		expect(gate.secret).toBe("secret-2");
		expect(gate.loading).toBe(false);
	});
});

describe("captchaRejection", () => {
	it("is the server's message for a refused captcha", () => {
		const message = "Captcha has already been used, please try another.";
		expect(captchaRejection(failure(400, message))).toBe(message);
	});

	it("is undefined for other refusals and server errors", () => {
		expect(
			captchaRejection(failure(400, "Invalid issue type")),
		).toBeUndefined();
		expect(captchaRejection(failure(500, "Captcha"))).toBeUndefined();
		expect(captchaRejection(failure(400))).toBeUndefined();
	});

	// No response at all (offline, timeout) must not throw while the form
	// picks its toast
	it("is undefined without a response", () => {
		const offline = new AxiosError("Network Error", "ERR_NETWORK");
		expect(captchaRejection(offline)).toBeUndefined();
		expect(captchaRejection(new Error("boom"))).toBeUndefined();
	});
});
