import { afterEach, describe, expect, it } from "vitest";

import { revealInScrollParent } from "./revealInScrollParent";

// jsdom does no layout: give each element the geometry the case needs
function box(el: HTMLElement, top: number, height: number) {
	el.getBoundingClientRect = () =>
		({ top, bottom: top + height, height }) as DOMRect;
}

function scroller(height: number, scrollHeight: number) {
	const el = document.createElement("div");
	el.style.overflowY = "auto";
	Object.defineProperty(el, "clientHeight", { value: height });
	Object.defineProperty(el, "scrollHeight", { value: scrollHeight });
	box(el, 0, height);
	return el;
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("revealInScrollParent", () => {
	it("scrolls the nearest scrollable ancestor until the bottom shows", () => {
		const panel = scroller(500, 1500);
		const block = document.createElement("div");
		panel.append(block);
		document.body.append(panel);
		box(block, 400, 300);

		revealInScrollParent(block);

		expect(panel.scrollTop).toBe(200);
	});

	it("keeps the top in view when the element is taller than the panel", () => {
		const panel = scroller(500, 1500);
		const block = document.createElement("div");
		panel.append(block);
		document.body.append(panel);
		box(block, 100, 800);

		revealInScrollParent(block);

		expect(panel.scrollTop).toBe(100);
	});

	it("leaves a panel alone when the element already fits", () => {
		const panel = scroller(500, 1500);
		const block = document.createElement("div");
		panel.append(block);
		document.body.append(panel);
		box(block, 100, 200);

		revealInScrollParent(block);

		expect(panel.scrollTop).toBe(0);
	});

	it("does nothing without a scrollable ancestor", () => {
		const block = document.createElement("div");
		document.body.append(block);
		box(block, 900, 300);

		expect(() => revealInScrollParent(block)).not.toThrow();
	});
});
