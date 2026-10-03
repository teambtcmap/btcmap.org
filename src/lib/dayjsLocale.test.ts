import { get, writable } from "svelte/store";
import { dayjs } from "svelte-time/dayjs";
import { describe, expect, it } from "vitest";

import { createTimeLocale, loadDayjsLocale } from "./dayjsLocale";

const now = new Date("2026-10-03T12:00:00Z");
const twoDaysAgo = new Date("2026-10-01T12:00:00Z");

describe("loadDayjsLocale", () => {
	it("registers the locale on the dayjs instance svelte-time renders with", async () => {
		const key = await loadDayjsLocale("de");

		expect(key).toBe("de");
		expect(dayjs(twoDaysAgo).locale(key).from(now)).toBe("vor 2 Tagen");
	});

	it("maps every app locale to its dayjs key, pt-BR included", async () => {
		const keys = [];
		for (const code of ["de", "es", "fr", "it", "nl", "pt-BR", "bg", "ru"]) {
			keys.push(await loadDayjsLocale(code));
		}
		expect(keys).toEqual(["de", "es", "fr", "it", "nl", "pt-br", "bg", "ru"]);
	});

	it("falls back to the base language, then to English", async () => {
		expect(await loadDayjsLocale("de-AT")).toBe("de");
		expect(await loadDayjsLocale("en")).toBe("en");
		expect(await loadDayjsLocale("xx")).toBe("en");
		expect(await loadDayjsLocale(null)).toBe("en");
	});
});

describe("createTimeLocale", () => {
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	it("follows the app locale once its dayjs locale has loaded", async () => {
		const appLocale = writable<string | null>("en");
		const timeLocale = createTimeLocale(appLocale);
		const seen: string[] = [];
		const unsubscribe = timeLocale.subscribe((key) => seen.push(key));

		appLocale.set("pt-BR");
		await settle();
		expect(get(timeLocale)).toBe("pt-br");
		expect(seen[0]).toBe("en");
		unsubscribe();
	});

	it("ignores a slower, older locale load", async () => {
		const appLocale = writable<string | null>("ru");
		const timeLocale = createTimeLocale(appLocale);
		const unsubscribe = timeLocale.subscribe(() => {});
		appLocale.set("de");
		await settle();
		await settle();
		expect(get(timeLocale)).toBe("de");
		unsubscribe();
	});
});
