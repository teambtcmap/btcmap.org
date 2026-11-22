import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const offline = () => {
	throw new Error("offline");
};

// Each case loads the module from scratch, like a page load: a fresh
// svelte-i18n, the given language saved, and the mocked locale files.
const startWith = async (language: string) => {
	localStorage.setItem("language", language);
	return import("./index");
};

describe("starting the locale", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		for (const code of ["de", "en", "nl"])
			vi.doUnmock(`./locales/${code}.json`);
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("starts in English when the chosen locale fails to load", async () => {
		vi.doMock("./locales/de.json", offline);
		const i18n = await startWith("de");

		await vi.waitFor(() => expect(get(i18n.locale)).toBe("en"));
		expect(get(i18n._)("mapControls.zoomIn")).toBe("Zoom in");
		expect(get(i18n.localeFailed)).toBe(false);
	});

	it("keeps the chosen locale when only English fails to load", async () => {
		vi.doMock("./locales/en.json", offline);
		const i18n = await startWith("de");

		await vi.waitFor(() => expect(get(i18n.locale)).toBe("de"));
		expect(get(i18n._)("mapControls.zoomIn")).toBe("Vergrößern");
		expect(get(i18n.localeFailed)).toBe(false);
	});

	it("keeps the chosen locale when English fails once and loads on the next try", async () => {
		let englishAttempts = 0;
		vi.doMock("./locales/en.json", async () => {
			englishAttempts += 1;
			if (englishAttempts === 1) offline();
			return vi.importActual("./locales/en.json");
		});
		const i18n = await startWith("de");

		await vi.waitFor(() => expect(get(i18n.locale)).toBe("de"));
		expect(get(i18n._)("mapControls.zoomIn")).toBe("Vergrößern");
	});

	it("reports the failure when no locale file loads", async () => {
		vi.doMock("./locales/de.json", offline);
		vi.doMock("./locales/en.json", offline);
		const i18n = await startWith("de");

		await vi.waitFor(() => expect(get(i18n.localeFailed)).toBe(true));
		expect(get(i18n.locale)).toBeFalsy();
	});

	it("drops the failure once a later switch loads a locale", async () => {
		// A ?language= link can still load its locale when the start failed
		vi.doMock("./locales/en.json", offline);
		const i18n = await startWith("en");
		await vi.waitFor(() => expect(get(i18n.localeFailed)).toBe(true));

		await i18n.locale.set("de");

		expect(get(i18n.locale)).toBe("de");
		expect(get(i18n.localeFailed)).toBe(false);
	});

	it("switches to English only once the English texts are in", async () => {
		// English loads along with the chosen locale, so it can still be on
		// its way when that one fails: hold it back
		let releaseEnglish: () => void = () => {};
		const held = new Promise<void>((resolve) => {
			releaseEnglish = resolve;
		});
		vi.doMock("./locales/de.json", offline);
		vi.doMock("./locales/en.json", async () => {
			await held;
			return vi.importActual("./locales/en.json");
		});
		const i18n = await startWith("de");

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(get(i18n.locale)).toBeFalsy();

		releaseEnglish();
		await vi.waitFor(() => expect(get(i18n.locale)).toBe("en"));
		expect(get(i18n._)("mapControls.zoomIn")).toBe("Zoom in");
	});

	it("keeps a ?language= switch made while the fallback loads English", async () => {
		let releaseEnglish: () => void = () => {};
		const held = new Promise<void>((resolve) => {
			releaseEnglish = resolve;
		});
		vi.doMock("./locales/de.json", offline);
		vi.doMock("./locales/en.json", async () => {
			await held;
			return vi.importActual("./locales/en.json");
		});
		const i18n = await startWith("de");
		// What +layout.svelte's afterNavigate calls on a ?language= link
		await i18n.locale.set("bg");

		releaseEnglish();
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(get(i18n.locale)).toBe("bg");
	});

	it("fetches a locale again on the next switch after it failed to load", async () => {
		let attempts = 0;
		vi.doMock("./locales/nl.json", async () => {
			attempts += 1;
			if (attempts === 1) offline();
			return vi.importActual("./locales/nl.json");
		});
		const i18n = await startWith("en");
		await vi.waitFor(() => expect(get(i18n.locale)).toBe("en"));

		await expect(i18n.locale.set("nl")).rejects.toThrow();
		// svelte-i18n keeps the locale it had
		expect(get(i18n.locale)).toBe("en");

		await i18n.locale.set("nl");

		expect(attempts).toBe(2);
		expect(get(i18n.locale)).toBe("nl");
		expect(get(i18n._)("mapControls.zoomIn")).toBe("Inzoomen");
	});
});
