import { afterEach, describe, expect, it } from "vitest";

import { portal } from "./portal";

describe("portal", () => {
	let host: HTMLElement;

	afterEach(() => host.remove());

	it("moves the node to the end of <body>", () => {
		host = document.createElement("div");
		const node = document.createElement("div");
		host.append(node);
		document.body.append(host);
		document.body.append(document.createElement("span"));

		portal(node);

		expect(node.parentElement).toBe(document.body);
		expect(document.body.lastElementChild).toBe(node);
	});

	it("removes the node on destroy", () => {
		host = document.createElement("div");
		const node = document.createElement("div");
		host.append(node);

		portal(node).destroy();

		expect(node.isConnected).toBe(false);
	});
});
