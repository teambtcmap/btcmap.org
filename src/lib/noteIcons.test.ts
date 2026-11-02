import { describe, expect, it, vi } from "vitest";

import {
	DEFAULT_NOTE_ICON,
	NOTE_ICONS,
	normalizeNoteIcon,
	noteIconCandidates,
	readyNoteIcon,
	resolveNoteIcon,
} from "./noteIcons";

describe("normalizeNoteIcon", () => {
	it("keeps a Material Symbols name", () => {
		expect(normalizeNoteIcon("local_parking")).toBe("local_parking");
		expect(normalizeNoteIcon("18_up_rating")).toBe("18_up_rating");
	});

	it("falls back to the default for anything that is not a symbol name", () => {
		// The icon is free text other clients wrote; it ends up in sprite
		// names and Iconify URLs, so only plain symbol names get through.
		for (const icon of ["", "Notes", "a/b", "x-y", "../svg", "atm?x=1"]) {
			expect(normalizeNoteIcon(icon)).toBe(DEFAULT_NOTE_ICON);
		}
	});
});

describe("noteIconCandidates", () => {
	it("tries the outlined symbol, then the filled one, then the default", () => {
		// Android draws from the outlined font; the 86 names that have no
		// separate outlined glyph only exist as the base name in Iconify.
		expect(noteIconCandidates("local_parking")).toEqual([
			"material-symbols:local-parking-outline",
			"material-symbols:local-parking",
			"material-symbols:notes-outline",
		]);
	});

	it("goes straight to the default for an invalid name", () => {
		expect(noteIconCandidates("a/b")).toEqual([
			"material-symbols:notes-outline",
		]);
	});

	it("does not repeat the default", () => {
		expect(noteIconCandidates(DEFAULT_NOTE_ICON)).toEqual([
			"material-symbols:notes-outline",
			"material-symbols:notes",
		]);
	});
});

// A stand-in for @iconify's store: `bundled` names are loaded up front,
// `remote` ones load on request, anything else fails to load.
const iconStore = (bundled: string[], remote: string[] = []) => {
	const loadedNames = new Set(bundled);
	const load = vi.fn(async (name: string) => {
		if (!loadedNames.has(name) && !remote.includes(name)) {
			throw new Error(`${name} not found`);
		}
		loadedNames.add(name);
	});
	return { loaded: (name: string) => loadedNames.has(name), load };
};

const DEFAULT = "material-symbols:notes-outline";

describe("readyNoteIcon", () => {
	it("paints a bundled first candidate without waiting", () => {
		const store = iconStore(["material-symbols:star-outline", DEFAULT]);
		expect(readyNoteIcon(noteIconCandidates("star"), store.loaded)).toBe(
			"material-symbols:star-outline",
		);
	});

	it("does not jump to the bundled default past an unbundled icon", () => {
		// #1605: the default is always bundled, so "first loaded candidate"
		// picked it and an Android-picked icon never got its load attempt.
		const store = iconStore([DEFAULT]);
		expect(readyNoteIcon(noteIconCandidates("pets"), store.loaded)).toBeNull();
	});
});

describe("resolveNoteIcon", () => {
	it("loads an unbundled Android icon instead of settling for the default", async () => {
		const store = iconStore([DEFAULT], ["material-symbols:pets-outline"]);
		await expect(
			resolveNoteIcon(noteIconCandidates("pets"), store),
		).resolves.toBe("material-symbols:pets-outline");
	});

	it("falls through to the filled name when there is no outlined glyph", async () => {
		const store = iconStore([DEFAULT], ["material-symbols:wc"]);
		await expect(
			resolveNoteIcon(noteIconCandidates("wc"), store),
		).resolves.toBe("material-symbols:wc");
		expect(store.load).toHaveBeenCalledWith("material-symbols:wc-outline");
	});

	it("ends on the bundled default when the icon cannot be loaded", async () => {
		const store = iconStore([DEFAULT]);
		await expect(
			resolveNoteIcon(noteIconCandidates("pets"), store),
		).resolves.toBe(DEFAULT);
	});

	it("does not request a candidate that is already loaded", async () => {
		const store = iconStore(["material-symbols:star-outline", DEFAULT]);
		await expect(
			resolveNoteIcon(noteIconCandidates("star"), store),
		).resolves.toBe("material-symbols:star-outline");
		expect(store.load).not.toHaveBeenCalled();
	});

	it("resolves to null when nothing loads", async () => {
		await expect(
			resolveNoteIcon(noteIconCandidates("pets"), iconStore([])),
		).resolves.toBeNull();
	});
});

describe("NOTE_ICONS", () => {
	it("starts with the default and has no duplicates or invalid names", () => {
		expect(NOTE_ICONS[0]).toBe(DEFAULT_NOTE_ICON);
		expect(new Set(NOTE_ICONS).size).toBe(NOTE_ICONS.length);
		for (const icon of NOTE_ICONS) expect(normalizeNoteIcon(icon)).toBe(icon);
	});
});
