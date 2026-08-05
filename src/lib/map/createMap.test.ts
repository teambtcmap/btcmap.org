import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasWebGLMock } = vi.hoisted(() => ({ hasWebGLMock: vi.fn() }));

vi.mock("$lib/map/webgl", () => ({ hasWebGL: hasWebGLMock }));
vi.mock("$lib/map/rtl", () => ({ ensureRtlTextPlugin: vi.fn() }));
vi.mock("$lib/map/worker", () => ({ ensureMapLibreWorkerUrl: vi.fn() }));
vi.mock("$lib/map/maplibreSprites", () => ({
	installPlaceholderHandler: vi.fn(),
}));

// Minimal stand-in for maplibre's Map: enough event plumbing to drive the
// load / style.load lifecycle the theme-swap state machine depends on.
class FakeMap {
	static instances: FakeMap[] = [];
	styleUrl: string;
	removed = false;
	setStyleCalls: string[] = [];
	private handlers = new Map<string, ((...args: unknown[]) => void)[]>();
	private onceHandlers = new Map<string, ((...args: unknown[]) => void)[]>();

	constructor(opts: { style: string }) {
		this.styleUrl = opts.style;
		FakeMap.instances.push(this);
	}
	on(event: string, cb: (...args: unknown[]) => void) {
		const list = this.handlers.get(event) ?? [];
		list.push(cb);
		this.handlers.set(event, list);
	}
	once(event: string, cb: (...args: unknown[]) => void) {
		const list = this.onceHandlers.get(event) ?? [];
		list.push(cb);
		this.onceHandlers.set(event, list);
	}
	addControl() {}
	setStyle(url: string) {
		this.setStyleCalls.push(url);
		this.styleUrl = url;
	}
	remove() {
		this.removed = true;
	}
	fire(event: string) {
		for (const cb of this.handlers.get(event) ?? []) cb();
		const once = this.onceHandlers.get(event) ?? [];
		this.onceHandlers.delete(event);
		for (const cb of once) cb();
	}
}

vi.mock("maplibre-gl", () => ({
	Map: FakeMap,
	NavigationControl: class {},
	GeolocateControl: class {},
}));

import { createBtcmapMap, styleUrlForTheme } from "./createMap";

const container = {} as HTMLElement;

const readyOutcome = async (
	overrides: Partial<Parameters<typeof createBtcmapMap>[0]> = {},
) => {
	const registerOverlays = vi.fn();
	const onFirstLoad = vi.fn();
	const onStyleReadyChange = vi.fn();
	const outcome = await createBtcmapMap({
		container,
		theme: "light",
		registerOverlays,
		onFirstLoad,
		onStyleReadyChange,
		...overrides,
	});
	if (outcome.status !== "ready") throw new Error("expected ready");
	const fake = FakeMap.instances[FakeMap.instances.length - 1];
	return {
		handle: outcome.handle,
		fake,
		registerOverlays,
		onFirstLoad,
		onStyleReadyChange,
	};
};

beforeEach(() => {
	FakeMap.instances = [];
	hasWebGLMock.mockReturnValue(true);
});

describe("styleUrlForTheme", () => {
	it("maps dark to the dark style and everything else to light", () => {
		expect(styleUrlForTheme("dark")).toContain("dark");
		expect(styleUrlForTheme("light")).not.toContain("dark");
		expect(styleUrlForTheme(undefined)).toBe(styleUrlForTheme("light"));
	});
});

describe("createBtcmapMap", () => {
	it("returns unsupported without constructing a Map when WebGL is missing", async () => {
		hasWebGLMock.mockReturnValue(false);
		const outcome = await createBtcmapMap({
			container,
			theme: "light",
			registerOverlays: vi.fn(),
		});
		expect(outcome.status).toBe("unsupported");
		expect(FakeMap.instances.length).toBe(0);
	});

	it("returns cancelled without constructing a Map when the component died mid-import", async () => {
		const outcome = await createBtcmapMap({
			container,
			theme: "light",
			registerOverlays: vi.fn(),
			isCancelled: () => true,
		});
		expect(outcome.status).toBe("cancelled");
		expect(FakeMap.instances.length).toBe(0);
	});

	it("runs overlays, first-load wiring, and the ready signal on load", async () => {
		const { fake, registerOverlays, onFirstLoad, onStyleReadyChange } =
			await readyOutcome();
		expect(registerOverlays).not.toHaveBeenCalled();

		fake.fire("load");

		expect(registerOverlays).toHaveBeenCalledTimes(1);
		expect(onFirstLoad).toHaveBeenCalledTimes(1);
		expect(onStyleReadyChange).toHaveBeenLastCalledWith(true);
	});

	it("swaps the style on a theme change and re-registers overlays on style.load", async () => {
		const { handle, fake, registerOverlays, onFirstLoad, onStyleReadyChange } =
			await readyOutcome();
		fake.fire("load");

		handle.setTheme("dark");
		expect(onStyleReadyChange).toHaveBeenLastCalledWith(false);
		expect(fake.setStyleCalls).toEqual([styleUrlForTheme("dark")]);

		fake.fire("style.load");
		expect(registerOverlays).toHaveBeenCalledTimes(2);
		// First-load wiring must NOT re-run on a theme swap
		expect(onFirstLoad).toHaveBeenCalledTimes(1);
		expect(onStyleReadyChange).toHaveBeenLastCalledWith(true);
	});

	it("ignores setTheme before the first load and for an unchanged theme", async () => {
		const { handle, fake } = await readyOutcome();

		// Not ready yet — a swap now would race the initial style load
		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual([]);

		fake.fire("load");
		handle.setTheme("light");
		expect(fake.setStyleCalls).toEqual([]);
	});

	it("treats undefined and light as the same theme — no restyle on resolve", async () => {
		// Callers may construct before the theme store resolves; undefined and
		// "light" map to the same style, so resolving must not restyle.
		const { handle, fake } = await readyOutcome({ theme: undefined });
		fake.fire("load");

		handle.setTheme("light");
		expect(fake.setStyleCalls).toEqual([]);

		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual([styleUrlForTheme("dark")]);
	});

	it("ignores setTheme while a previous swap's style is still loading", async () => {
		const { handle, fake } = await readyOutcome();
		fake.fire("load");

		handle.setTheme("dark");
		handle.setTheme("light");
		expect(fake.setStyleCalls).toEqual([styleUrlForTheme("dark")]);

		// Once the swap settles, the component's readiness reactive re-invokes
		fake.fire("style.load");
		handle.setTheme("light");
		expect(fake.setStyleCalls).toEqual([
			styleUrlForTheme("dark"),
			styleUrlForTheme("light"),
		]);
	});

	it("destroy removes the map and inert-s the handle", async () => {
		const { handle, fake, registerOverlays } = await readyOutcome();
		fake.fire("load");

		handle.destroy();
		expect(fake.removed).toBe(true);

		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual([]);

		// A straggling event after teardown must not touch callbacks
		fake.fire("style.load");
		expect(registerOverlays).toHaveBeenCalledTimes(1);
	});
});
