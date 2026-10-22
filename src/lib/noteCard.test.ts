import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";

import { noteCard, parseNoteParam } from "./noteCard";

beforeEach(() => noteCard.close());

describe("noteCard", () => {
	it("opens the add card at a point and closes it", () => {
		noteCard.openCreate(52.5, 13.4, "right_click");
		expect(get(noteCard)).toEqual({
			mode: "create",
			lat: 52.5,
			lon: 13.4,
			method: "right_click",
		});

		noteCard.close();
		expect(get(noteCard)).toBeNull();
	});

	it("moves the add card's pin and leaves other cards alone", () => {
		noteCard.openCreate(1, 2, "long_press");
		noteCard.moveDraft(3, 4);
		expect(get(noteCard)).toEqual({
			mode: "create",
			lat: 3,
			lon: 4,
			method: "long_press",
		});

		noteCard.openView(7);
		noteCard.moveDraft(5, 6);
		expect(get(noteCard)).toEqual({ mode: "view", id: 7 });
	});

	it("opening a note replaces an unsaved add card", () => {
		noteCard.openCreate(1, 2, "menu");
		noteCard.openView(7);
		expect(get(noteCard)).toEqual({ mode: "view", id: 7 });
	});
});

describe("parseNoteParam", () => {
	it("reads a positive integer id", () => {
		expect(parseNoteParam("42")).toBe(42);
	});

	it("rejects anything else", () => {
		for (const raw of [null, "", "0", "-1", "1.5", "abc", "12abc"]) {
			expect(parseNoteParam(raw)).toBeNull();
		}
	});
});
