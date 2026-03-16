import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock svelte-i18n to prevent module-level side effects
vi.mock("svelte-i18n", () => ({
	_: vi.fn(),
	init: vi.fn(),
	locale: { subscribe: vi.fn() },
	register: vi.fn(),
}));

import { getDisplayLang } from "./index";

describe("getDisplayLang", () => {
	describe("non-English app locale", () => {
		it("returns base language for pt-BR locale", () => {
			expect(getDisplayLang("pt-BR")).toBe("pt");
		});

		it("returns base language for bg locale", () => {
			expect(getDisplayLang("bg")).toBe("bg");
		});

		it("returns base language for ru locale", () => {
			expect(getDisplayLang("ru")).toBe("ru");
		});

		it("returns base language for de locale", () => {
			expect(getDisplayLang("de")).toBe("de");
		});
	});

	describe("English app locale", () => {
		beforeEach(() => {
			// Reset navigator.language to English
			Object.defineProperty(navigator, "language", {
				value: "en-US",
				configurable: true,
			});
			Object.defineProperty(navigator, "languages", {
				value: ["en-US"],
				configurable: true,
			});
		});

		it("returns en when app locale is en and browser language is English", () => {
			expect(getDisplayLang("en")).toBe("en");
		});

		it("returns en when app locale is null and browser language is English", () => {
			expect(getDisplayLang(null)).toBe("en");
		});

		it("returns en when app locale is undefined and browser language is English", () => {
			expect(getDisplayLang(undefined)).toBe("en");
		});

		it("returns browser base language when browser language is non-English", () => {
			Object.defineProperty(navigator, "language", {
				value: "de-DE",
				configurable: true,
			});
			expect(getDisplayLang("en")).toBe("de");
		});

		it("returns browser base language for pt-BR browser with English app locale", () => {
			Object.defineProperty(navigator, "language", {
				value: "pt-BR",
				configurable: true,
			});
			expect(getDisplayLang("en")).toBe("pt");
		});
	});

	describe("SSR safety (window undefined)", () => {
		it("returns en when window is not available and app locale is English", () => {
			// Temporarily hide window to simulate SSR
			const originalWindow = globalThis.window;
			// @ts-expect-error simulate SSR
			delete globalThis.window;
			try {
				expect(getDisplayLang("en")).toBe("en");
			} finally {
				globalThis.window = originalWindow;
			}
		});

		it("still returns non-English locale when window is not available", () => {
			const originalWindow = globalThis.window;
			// @ts-expect-error simulate SSR
			delete globalThis.window;
			try {
				expect(getDisplayLang("de")).toBe("de");
			} finally {
				globalThis.window = originalWindow;
			}
		});
	});
});
