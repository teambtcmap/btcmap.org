import { describe, expect, it } from "vitest";

import {
	DEFAULT_NOTE_ICON,
	NOTE_ICONS,
	normalizeNoteIcon,
	noteIconCandidates,
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

describe("NOTE_ICONS", () => {
	it("starts with the default and has no duplicates or invalid names", () => {
		expect(NOTE_ICONS[0]).toBe(DEFAULT_NOTE_ICON);
		expect(new Set(NOTE_ICONS).size).toBe(NOTE_ICONS.length);
		for (const icon of NOTE_ICONS) expect(normalizeNoteIcon(icon)).toBe(icon);
	});
});
