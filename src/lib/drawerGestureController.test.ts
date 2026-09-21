import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

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

	it("leaves an expanded sheet at its expanded height", () => {
		const controller = createDrawerGestureController({ peekHeight: 88 });
		controller.setExpandedHeight(600);
		controller.expand();
		expect(get(controller.drawerHeight)).toBe(600);

		controller.setPeekHeight(140);

		// Still expanded, still 600 — the note only changes where "collapsed"
		// sits, never what the open sheet does.
		expect(get(controller.expanded)).toBe(true);
		expect(get(controller.drawerHeight)).toBe(600);
	});

	it("collapses to the height set most recently", () => {
		const controller = createDrawerGestureController({ peekHeight: 88 });
		controller.setExpandedHeight(600);
		controller.expand();

		controller.setPeekHeight(140);
		controller.collapse();
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
