import { describe, expect, it } from "vitest";

import { PEEK_HEIGHT } from "./drawerConfig";
import {
	calculateDragHeight,
	createVelocityState,
	determineSnapState,
	resetVelocityState,
	updateVelocity,
} from "./drawerGestureUtils";

describe("determineSnapState", () => {
	const EXPANDED = 667;

	it("snaps to expanded on high upward velocity", () => {
		const result = determineSnapState(0.6, 50, 300, EXPANDED);
		expect(result).toEqual({ expanded: true, height: EXPANDED });
	});

	it("snaps to peek on high downward velocity", () => {
		const result = determineSnapState(-0.6, -50, 300, EXPANDED);
		expect(result).toEqual({ expanded: false, height: PEEK_HEIGHT });
	});

	it("snaps to expanded on large upward distance", () => {
		const result = determineSnapState(0.1, 100, 400, EXPANDED);
		expect(result).toEqual({ expanded: true, height: EXPANDED });
	});

	it("snaps to peek on large downward distance", () => {
		const result = determineSnapState(0.1, -100, 200, EXPANDED);
		expect(result).toEqual({ expanded: false, height: PEEK_HEIGHT });
	});

	it("snaps to nearest on small movement - above threshold", () => {
		// threshold = 140 + (667-140)*0.3 = 298.1
		const result = determineSnapState(0.1, 10, 350, EXPANDED);
		expect(result).toEqual({ expanded: true, height: EXPANDED });
	});

	it("snaps to nearest on small movement - below threshold", () => {
		const result = determineSnapState(0.1, -10, 200, EXPANDED);
		expect(result).toEqual({ expanded: false, height: PEEK_HEIGHT });
	});

	it("velocity takes priority over distance", () => {
		// High upward velocity should expand even with downward distance
		const result = determineSnapState(0.6, -100, 200, EXPANDED);
		expect(result).toEqual({ expanded: true, height: EXPANDED });
	});

	it("handles edge case at exact threshold", () => {
		// At exactly the velocity threshold
		const result = determineSnapState(0.5, 0, 300, EXPANDED);
		// 0.5 is not > 0.5, so it falls through to distance check
		// Distance is 0, which is not > 80 or < -80
		// Falls through to position check: 300 > 298.1 → expanded
		expect(result).toEqual({ expanded: true, height: EXPANDED });
	});
});

describe("updateVelocity", () => {
	it("returns new state with updated velocity", () => {
		const initial = createVelocityState(100, 1000);
		const result = updateVelocity(90, 1010, initial);

		expect(result.lastY).toBe(90);
		expect(result.lastTime).toBe(1010);
		expect(result.samples.length).toBe(1);
		expect(result.velocity).toBe(1); // (100-90)/10 = 1 px/ms
	});

	it("calculates negative velocity for downward movement", () => {
		const initial = createVelocityState(100, 1000);
		const result = updateVelocity(110, 1010, initial);

		expect(result.velocity).toBe(-1); // (100-110)/10 = -1 px/ms
	});

	it("maintains rolling average of samples", () => {
		let state = createVelocityState(100, 1000);
		for (let i = 1; i <= 6; i++) {
			state = updateVelocity(100 - i * 10, 1000 + i * 10, state);
		}
		// Should only keep last 5 samples
		expect(state.samples.length).toBe(5);
	});

	it("does not update velocity if time delta is zero", () => {
		const initial = createVelocityState(100, 1000);
		const result = updateVelocity(90, 1000, initial);
		expect(result.velocity).toBe(0);
		expect(result.samples.length).toBe(0);
		// But should still update position
		expect(result.lastY).toBe(90);
		expect(result.lastTime).toBe(1000);
	});

	it("does not mutate original state", () => {
		const initial = createVelocityState(100, 1000);
		const originalSamples = initial.samples;
		updateVelocity(90, 1010, initial);

		expect(initial.samples).toBe(originalSamples);
		expect(initial.samples.length).toBe(0);
		expect(initial.velocity).toBe(0);
		expect(initial.lastY).toBe(100);
	});

	it("averages multiple velocity samples", () => {
		let state = createVelocityState(100, 1000);
		// First move: 10px in 10ms = 1 px/ms
		state = updateVelocity(90, 1010, state);
		// Second move: 20px in 10ms = 2 px/ms
		state = updateVelocity(70, 1020, state);

		expect(state.samples.length).toBe(2);
		expect(state.velocity).toBe(1.5); // (1 + 2) / 2
	});
});

describe("createVelocityState", () => {
	it("creates state with given initial values", () => {
		const state = createVelocityState(250, 12345);

		expect(state.lastY).toBe(250);
		expect(state.lastTime).toBe(12345);
		expect(state.samples).toEqual([]);
		expect(state.velocity).toBe(0);
	});
});

describe("resetVelocityState", () => {
	it("creates zeroed state", () => {
		const state = resetVelocityState();

		expect(state.lastY).toBe(0);
		expect(state.lastTime).toBe(0);
		expect(state.samples).toEqual([]);
		expect(state.velocity).toBe(0);
	});
});

describe("calculateDragHeight", () => {
	it("calculates height within bounds", () => {
		// Dragging up 100px from 200px height
		expect(calculateDragHeight(500, 400, 200, 140, 667)).toBe(300);
	});

	it("clamps to minimum", () => {
		// Trying to drag below minimum
		expect(calculateDragHeight(500, 700, 200, 140, 667)).toBe(140);
	});

	it("clamps to maximum", () => {
		// Trying to drag above maximum
		expect(calculateDragHeight(500, 100, 200, 140, 667)).toBe(600);
	});

	it("handles negative delta (dragging down)", () => {
		// Dragging down 50px from 300px height
		expect(calculateDragHeight(500, 550, 300, 140, 667)).toBe(250);
	});

	it("handles zero delta", () => {
		expect(calculateDragHeight(500, 500, 300, 140, 667)).toBe(300);
	});
});
