import { describe, expect, it } from "vitest";

import {
	PAYMENT_NOTE_PEEK_EXTRA,
	SEARCH_SHEET_PEEK_HEIGHT,
	searchSheetPeekHeight,
} from "./drawerConfig";

// #1430. The panel sizes the sheet and the page publishes the CSS variable
// the bottom map chrome lifts by; both ask this, so a drift between them
// puts the sheet on top of the OSM attribution (or lifts the chrome over a
// peek that isn't there).
describe("searchSheetPeekHeight", () => {
	it("is the bare peek without the note", () => {
		expect(searchSheetPeekHeight(false)).toBe(SEARCH_SHEET_PEEK_HEIGHT);
	});

	it("adds the note's room when it carries one", () => {
		expect(searchSheetPeekHeight(true)).toBe(
			SEARCH_SHEET_PEEK_HEIGHT + PAYMENT_NOTE_PEEK_EXTRA,
		);
	});

	it("measures the sheet, not the viewport", () => {
		// Guards the derivation in the constant's comment: content 138 under a
		// 16px grabber, plus a text-sm line of headroom.
		expect(searchSheetPeekHeight(true)).toBe(174);
		expect(searchSheetPeekHeight(false)).toBe(88);
	});
});
