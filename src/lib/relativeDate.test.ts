import { describe, expect, it } from "vitest";

import { formatRelativeDate, loadDateLocale } from "./relativeDate";

const now = new Date("2026-10-03T12:00:00Z");

describe("formatRelativeDate", () => {
	it("formats in English without a locale", () => {
		expect(formatRelativeDate("2026-10-01T12:00:00Z", undefined, now)).toBe(
			"2 days ago",
		);
	});

	it("formats in the app locale once it is loaded", async () => {
		const de = await loadDateLocale("de");
		expect(formatRelativeDate("2026-10-01T12:00:00Z", de, now)).toBe(
			"vor 2 Tagen",
		);
	});
});

describe("loadDateLocale", () => {
	it("maps every app locale, including pt-BR", async () => {
		for (const code of ["de", "es", "fr", "it", "nl", "pt-BR", "bg", "ru"]) {
			expect((await loadDateLocale(code))?.code).toBe(code);
		}
	});

	it("falls back to the base language and to English", async () => {
		expect((await loadDateLocale("de-AT"))?.code).toBe("de");
		expect(await loadDateLocale("en")).toBeUndefined();
		expect(await loadDateLocale("xx")).toBeUndefined();
		expect(await loadDateLocale(null)).toBeUndefined();
	});
});
