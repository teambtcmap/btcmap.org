import { describe, expect, it } from "vitest";

import { PIN_HEIGHT } from "./maplibreSprites";
import {
	CARD_PIN_GAP,
	cardOverflow,
	EDGE_MARGIN,
	frameOffset,
} from "./noteCardFraming";

describe("frameOffset", () => {
	it("desktop: puts the pin low enough for the card to fit above it", () => {
		// 800px map, 500px card: pin at 500 + gap + margin from the top
		const [x, y] = frameOffset({
			desktop: true,
			cardHeight: 500,
			mapHeight: 800,
		});
		expect(x).toBe(0);
		expect(400 + y).toBe(500 + CARD_PIN_GAP + EDGE_MARGIN);
	});

	it("desktop: never moves the pin above the centre for a short card", () => {
		expect(
			frameOffset({ desktop: true, cardHeight: 50, mapHeight: 800 }),
		).toEqual([0, 0]);
	});

	it("desktop: keeps the pin on screen for a card taller than the map", () => {
		const [, y] = frameOffset({
			desktop: true,
			cardHeight: 900,
			mapHeight: 800,
		});
		expect(400 + y).toBe(800 - EDGE_MARGIN);
	});

	it("mobile: centres the pin in the map left above the bottom card", () => {
		const [, y] = frameOffset({
			desktop: false,
			cardHeight: 400,
			mapHeight: 844,
		});
		expect(y).toBe(-200 + PIN_HEIGHT / 2);
	});
});

describe("cardOverflow", () => {
	it("is how far the card would run past the top margin", () => {
		expect(cardOverflow({ cardHeight: 400, pinY: 300 })).toBe(
			400 + CARD_PIN_GAP + EDGE_MARGIN - 300,
		);
	});

	it("is zero when the card fits", () => {
		expect(cardOverflow({ cardHeight: 100, pinY: 600 })).toBe(0);
	});
});
