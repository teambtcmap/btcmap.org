import { describe, expect, it } from "vitest";

import type { PanelState } from "./nostrMethodLayout";
import {
	isForm,
	isPairing,
	methodBlocked,
	methodOpen,
	nostrMethodLayout,
	pairingClick,
	rowClick,
} from "./nostrMethodLayout";

describe("nostrMethodLayout", () => {
	it("leads with the signer-app hand-off on a touch device", () => {
		expect(
			nostrMethodLayout({
				isTouch: true,
				hasExtension: false,
				hasSaved: false,
			}),
		).toEqual({
			primary: "open",
			rows: ["qr", "copy"],
			more: ["bunker", "nsec"],
		});
	});

	it("leads with a detected extension on desktop and lists the hand-off", () => {
		expect(
			nostrMethodLayout({
				isTouch: false,
				hasExtension: true,
				hasSaved: false,
			}),
		).toEqual({
			primary: "extension",
			rows: ["qr", "open", "copy"],
			more: ["bunker", "nsec"],
		});
	});

	it("promotes the QR code on desktop without an extension and drops its row", () => {
		expect(
			nostrMethodLayout({
				isTouch: false,
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
			nostrMethodLayout({ isTouch: true, hasExtension: true, hasSaved: false })
				.rows,
		).toEqual(["qr", "copy", "extension"]);
	});

	it("lets a saved signer win and moves the device primary into the list", () => {
		expect(
			nostrMethodLayout({ isTouch: true, hasExtension: false, hasSaved: true }),
		).toEqual({
			primary: "saved",
			rows: ["open", "qr", "copy"],
			more: ["bunker", "nsec"],
		});
		expect(
			nostrMethodLayout({ isTouch: false, hasExtension: true, hasSaved: true })
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
	uriReady: false,
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
		const state: PanelState = {
			...idle,
			signerRun: "open",
			pairMode: "open",
			uriReady: true,
		};
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

describe("methodBlocked before the connection string exists", () => {
	const connecting: PanelState = { ...idle, signerRun: "qr", pairMode: "qr" };

	it("blocks switching presentation: there is nothing to show yet", () => {
		expect(methodBlocked("copy", connecting)).toBe(true);
		expect(methodBlocked("open", connecting)).toBe(true);
	});

	it("leaves the running row live, so a tap can close it", () => {
		expect(methodBlocked("qr", connecting)).toBe(false);
	});
});

describe("pairingClick", () => {
	it("starts a session when nothing runs", () => {
		expect(pairingClick(idle)).toBe("start");
	});

	it("switches presentation once the running pairing has its URI", () => {
		expect(
			pairingClick({
				...idle,
				signerRun: "qr",
				pairMode: "qr",
				uriReady: true,
			}),
		).toBe("switch");
	});

	it("ignores clicks before the URI or while another transport runs", () => {
		expect(pairingClick({ ...idle, signerRun: "qr", pairMode: "qr" })).toBe(
			"ignore",
		);
		expect(pairingClick({ ...idle, signerRun: "bunker" })).toBe("ignore");
		expect(pairingClick({ ...idle, extensionSigning: true })).toBe("ignore");
		expect(pairingClick({ ...idle, nsecSigning: true })).toBe("ignore");
	});
});

describe("rowClick", () => {
	it("closes the running pairing row", () => {
		const state: PanelState = { ...idle, signerRun: "qr", pairMode: "qr" };
		expect(rowClick("qr", state)).toBe("close");
		expect(rowClick("copy", state)).toBe("activate");
	});

	it("leaves form rows to toggle themselves", () => {
		expect(rowClick("bunker", { ...idle, formOpen: "bunker" })).toBe(
			"activate",
		);
		expect(rowClick("bunker", { ...idle, signerRun: "bunker" })).toBe(
			"activate",
		);
	});
});

describe("isPairing / isForm", () => {
	it("tells the nostrconnect presentations and the form rows apart", () => {
		expect(["qr", "open", "copy"].every((m) => isPairing(m as never))).toBe(
			true,
		);
		expect(isPairing("bunker")).toBe(false);
		expect(isPairing(null)).toBe(false);
		expect(isForm("nsec")).toBe(true);
		expect(isForm("qr")).toBe(false);
	});
});
