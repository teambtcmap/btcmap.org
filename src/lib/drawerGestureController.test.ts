import { get } from "svelte/store";
import { describe, expect, it, vi } from "vitest";

// The controller reports snaps to analytics, which reaches $app/environment
// and its SvelteKit build-time defines. Same stub the store specs use.
vi.mock("$lib/analytics", () => ({ trackEvent: vi.fn() }));

import { createDrawerGestureController } from "./drawerGestureController";

// #1427: the search sheet's peek has to grow when it carries the payment
// empty-state note and shrink back when it doesn't, so peekHeight stops
// being fixed for the life of the controller.
describe("createDrawerGestureController — setPeekHeight", () => {
	it("moves a collapsed sheet to the new peek height", () => {
		const controller = createDrawerGestureController({ peekHeight: 88 });
		expect(get(controller.drawerHeight)).toBe(88);

		controller.setPeekHeight(140);

		expect(get(controller.expanded)).toBe(false);
		expect(get(controller.drawerHeight)).toBe(140);
	});

	// expand() and collapse() drive a spring, so the height they animate
	// towards is not readable on the next line. These assert through
	// resetToPeek(), the one hard set, which is what makes the stored value
	// observable without waiting on an animation.
	it("does not disturb an expanded sheet", () => {
		const controller = createDrawerGestureController({ peekHeight: 88 });
		controller.setExpandedHeight(600);
		controller.expand();

		controller.setPeekHeight(140);

		// The note changes where "collapsed" sits, never what the open sheet
		// does — in particular it must not hard-snap an open sheet to 140.
		expect(get(controller.expanded)).toBe(true);
		expect(get(controller.drawerHeight)).not.toBe(140);
	});

	it("stores the height for the next reset, even when set while expanded", () => {
		const controller = createDrawerGestureController({ peekHeight: 88 });
		controller.setExpandedHeight(600);
		controller.expand();

		controller.setPeekHeight(140);
		controller.resetToPeek();
		expect(get(controller.drawerHeight)).toBe(140);

		// And back down again when the note goes away.
		controller.setPeekHeight(88);
		expect(get(controller.drawerHeight)).toBe(88);
	});

	it("is a no-op when the height is unchanged", () => {
		const controller = createDrawerGestureController({ peekHeight: 88 });
		controller.setPeekHeight(88);
		expect(get(controller.drawerHeight)).toBe(88);
	});
});
