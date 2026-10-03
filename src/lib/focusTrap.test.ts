import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trapTab } from "./focusTrap";

const tab = (shiftKey = false) =>
	new KeyboardEvent("keydown", { key: "Tab", shiftKey, cancelable: true });

describe("trapTab", () => {
	let root: HTMLElement;
	let first: HTMLButtonElement;
	let last: HTMLButtonElement;

	beforeEach(() => {
		// jsdom lays nothing out; treat every element as rendered
		vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
			length: 1,
		} as DOMRectList);
		root = document.createElement("div");
		root.innerHTML = `
			<button id="first">a</button>
			<button disabled>skip</button>
			<a href="#">link</a>
			<button id="last">b</button>`;
		document.body.append(root);
		first = root.querySelector("#first") as HTMLButtonElement;
		last = root.querySelector("#last") as HTMLButtonElement;
	});

	afterEach(() => {
		root.remove();
		vi.restoreAllMocks();
	});

	it("wraps Tab from the last element to the first", () => {
		last.focus();
		const event = tab();
		trapTab(event, root);
		expect(document.activeElement).toBe(first);
		expect(event.defaultPrevented).toBe(true);
	});

	it("wraps Shift+Tab from the first element to the last", () => {
		first.focus();
		trapTab(tab(true), root);
		expect(document.activeElement).toBe(last);
	});

	it("pulls focus back in when it sits outside the root", () => {
		const outside = document.createElement("button");
		document.body.append(outside);
		outside.focus();
		trapTab(tab(), root);
		expect(document.activeElement).toBe(first);
		outside.remove();
	});

	it("leaves Tab to another open dialog that holds focus", () => {
		const dialog = document.createElement("div");
		dialog.setAttribute("aria-modal", "true");
		dialog.innerHTML = '<button id="in-dialog">x</button>';
		document.body.append(dialog);
		const inDialog = dialog.querySelector("#in-dialog") as HTMLButtonElement;
		inDialog.focus();

		const event = tab();
		trapTab(event, root);
		expect(document.activeElement).toBe(inDialog);
		expect(event.defaultPrevented).toBe(false);

		// Also when that dialog is rendered inside the trapped root
		root.append(dialog);
		inDialog.focus();
		trapTab(tab(), root);
		expect(document.activeElement).toBe(inDialog);
		dialog.remove();
	});

	it("leaves Tab between inner elements to the browser", () => {
		first.focus();
		const event = tab();
		trapTab(event, root);
		expect(event.defaultPrevented).toBe(false);
	});

	it("ignores controls that aren't Tab stops at either end", () => {
		// tabindex="-1" and fieldset-disabled controls match the selector but
		// the browser never tabs to them
		root.insertAdjacentHTML(
			"afterbegin",
			'<button tabindex="-1">pre</button><fieldset disabled><button tabindex="0">pre2</button></fieldset>',
		);
		root.insertAdjacentHTML(
			"beforeend",
			'<button tabindex="-1">post</button><fieldset disabled><button tabindex="0">post2</button></fieldset>',
		);

		last.focus();
		trapTab(tab(), root);
		expect(document.activeElement).toBe(first);

		first.focus();
		trapTab(tab(true), root);
		expect(document.activeElement).toBe(last);
	});

	it("ignores controls hidden with visibility, also when inherited", () => {
		root.insertAdjacentHTML(
			"beforeend",
			'<button style="visibility: hidden">own</button><div style="visibility: hidden"><button>inherited</button></div>',
		);

		last.focus();
		trapTab(tab(), root);
		expect(document.activeElement).toBe(first);
	});

	it("treats a radio group as one Tab stop: the checked radio", () => {
		// Like the basemap picker that ends MapToolsModal
		root.insertAdjacentHTML(
			"beforeend",
			'<input type="radio" name="basemap" id="liberty" checked><input type="radio" name="basemap" id="osm">',
		);
		const liberty = root.querySelector("#liberty") as HTMLInputElement;

		liberty.focus();
		trapTab(tab(), root);
		expect(document.activeElement).toBe(first);

		first.focus();
		trapTab(tab(true), root);
		expect(document.activeElement).toBe(liberty);
	});

	it("uses a group's first radio when none is checked", () => {
		root.insertAdjacentHTML(
			"beforeend",
			'<input type="radio" name="size" id="small"><input type="radio" name="size" id="large">',
		);
		const small = root.querySelector("#small") as HTMLInputElement;

		small.focus();
		trapTab(tab(), root);
		expect(document.activeElement).toBe(first);
	});

	it("wraps when focus sits inside the root but past a boundary", () => {
		// The list panel focuses its tabindex="-1" list container after
		// "enable location"; with an empty list nothing follows it
		root.insertAdjacentHTML(
			"beforeend",
			'<div tabindex="-1" id="after">empty list</div>',
		);
		root.insertAdjacentHTML(
			"afterbegin",
			'<div tabindex="-1" id="before">intro</div>',
		);
		const after = root.querySelector("#after") as HTMLElement;
		const before = root.querySelector("#before") as HTMLElement;

		after.focus();
		trapTab(tab(), root);
		expect(document.activeElement).toBe(first);

		before.focus();
		trapTab(tab(true), root);
		expect(document.activeElement).toBe(last);
	});

	it("leaves Tab from a focused container between controls to the browser", () => {
		first.insertAdjacentHTML("afterend", '<div tabindex="-1" id="mid">x</div>');
		const mid = root.querySelector("#mid") as HTMLElement;
		mid.focus();

		const event = tab();
		trapTab(event, root);
		expect(event.defaultPrevented).toBe(false);
	});

	it("ignores other keys", () => {
		last.focus();
		const event = new KeyboardEvent("keydown", {
			key: "Enter",
			cancelable: true,
		});
		trapTab(event, root);
		expect(document.activeElement).toBe(last);
		expect(event.defaultPrevented).toBe(false);
	});
});
