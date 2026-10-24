import { describe, expect, it } from "vitest";

import type { PanelState } from "./nostrMethodLayout";
import {
	methodBlocked,
	methodOpen,
	nostrMethodLayout,
} from "./nostrMethodLayout";

describe("nostrMethodLayout", () => {
	it("leads with the signer-app hand-off on a touch device", () => {
		expect(
			nostrMethodLayout({ coarse: true, hasExtension: false, hasSaved: false }),
		).toEqual({
			primary: "open",
			rows: ["qr", "copy"],
			more: ["bunker", "nsec"],
		});
	});

	it("leads with a detected extension on desktop and lists the hand-off", () => {
		expect(
			nostrMethodLayout({ coarse: false, hasExtension: true, hasSaved: false }),
		).toEqual({
			primary: "extension",
			rows: ["qr", "open", "copy"],
			more: ["bunker", "nsec"],
		});
	});

	it("promotes the QR code on desktop without an extension and drops its row", () => {
		expect(
			nostrMethodLayout({
				coarse: false,
				hasExtension: false,
				hasSaved: false,
			}),
		).toEqual({
			primary: "qr",
			rows: ["open", "copy"],
			more: ["bunker", "nsec"],
		});
	});

	it("keeps a detected extension as a row on a touch device", () => {
		expect(
			nostrMethodLayout({ coarse: true, hasExtension: true, hasSaved: false })
				.rows,
		).toEqual(["qr", "copy", "extension"]);
	});

	it("lets a saved signer win and moves the device primary into the list", () => {
		expect(
			nostrMethodLayout({ coarse: true, hasExtension: false, hasSaved: true }),
		).toEqual({
			primary: "saved",
			rows: ["open", "qr", "copy"],
			more: ["bunker", "nsec"],
		});
		expect(
			nostrMethodLayout({ coarse: false, hasExtension: true, hasSaved: true })
				.rows,
		).toEqual(["extension", "qr", "open", "copy"]);
	});
});

const idle: PanelState = {
	signerRun: null,
	pairMode: null,
	formOpen: null,
	extensionSigning: false,
	nsecSigning: false,
};

describe("methodOpen", () => {
	it("opens the pairing row whose presentation is showing", () => {
		const state: PanelState = { ...idle, signerRun: "qr", pairMode: "copy" };
		expect(methodOpen("copy", state)).toBe(true);
		expect(methodOpen("qr", state)).toBe(false);
	});

	it("keeps the bunker row open while its run waits, form closed or not", () => {
		expect(methodOpen("bunker", { ...idle, signerRun: "bunker" })).toBe(true);
		expect(methodOpen("bunker", { ...idle, formOpen: "bunker" })).toBe(true);
		expect(methodOpen("nsec", { ...idle, formOpen: "bunker" })).toBe(false);
	});

	it("never opens the extension row: it has no body", () => {
		expect(methodOpen("extension", { ...idle, extensionSigning: true })).toBe(
			false,
		);
	});
});

describe("methodBlocked", () => {
	it("blocks nothing when idle", () => {
		for (const method of [
			"saved",
			"extension",
			"open",
			"qr",
			"copy",
			"bunker",
			"nsec",
		] as const) {
			expect(methodBlocked(method, idle)).toBe(false);
		}
	});

	it("lets a running pairing switch presentation but blocks the rest", () => {
		const state: PanelState = { ...idle, signerRun: "open", pairMode: "open" };
		expect(methodBlocked("qr", state)).toBe(false);
		expect(methodBlocked("copy", state)).toBe(false);
		expect(methodBlocked("bunker", state)).toBe(true);
		expect(methodBlocked("nsec", state)).toBe(true);
		expect(methodBlocked("extension", state)).toBe(true);
	});

	it("blocks the pairing rows while another transport runs", () => {
		expect(methodBlocked("qr", { ...idle, signerRun: "bunker" })).toBe(true);
		expect(methodBlocked("qr", { ...idle, nsecSigning: true })).toBe(true);
		expect(methodBlocked("open", { ...idle, extensionSigning: true })).toBe(
			true,
		);
	});
});
