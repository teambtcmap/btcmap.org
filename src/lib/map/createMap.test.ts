import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasWebGLMock } = vi.hoisted(() => ({ hasWebGLMock: vi.fn() }));

vi.mock("$lib/map/webgl", () => ({ hasWebGL: hasWebGLMock }));
vi.mock("$lib/map/rtl", () => ({ ensureRtlTextPlugin: vi.fn() }));
vi.mock("$lib/map/worker", () => ({ ensureMapLibreWorkerUrl: vi.fn() }));
vi.mock("$lib/map/maplibreSprites", () => ({
	installPlaceholderHandler: vi.fn(),
}));

// Minimal stand-in for maplibre's Map: enough event plumbing to drive the
// load / style.load lifecycle the style-swap state machine depends on.
// fire() awaits handler promises — the facade's load and style.load
// callbacks are async (they await registerOverlays).
class FakeMap {
	static instances: FakeMap[] = [];
	ctorOptions: Record<string, unknown>;
	styleUrl: unknown;
	removed = false;
	setStyleCalls: unknown[] = [];
	controlsAdded = 0;
	private handlers = new Map<string, ((...args: unknown[]) => unknown)[]>();
	private onceHandlers = new Map<string, ((...args: unknown[]) => unknown)[]>();

	constructor(opts: Record<string, unknown>) {
		this.ctorOptions = opts;
		this.styleUrl = opts.style;
		FakeMap.instances.push(this);
	}
	on(event: string, cb: (...args: unknown[]) => unknown) {
		const list = this.handlers.get(event) ?? [];
		list.push(cb);
		this.handlers.set(event, list);
	}
	once(event: string, cb: (...args: unknown[]) => unknown) {
		const list = this.onceHandlers.get(event) ?? [];
		list.push(cb);
		this.onceHandlers.set(event, list);
	}
	addControl() {
		this.controlsAdded++;
	}
	setStyle(style: unknown) {
		this.setStyleCalls.push(style);
		this.styleUrl = style;
	}
	remove() {
		this.removed = true;
	}
	async fire(event: string) {
		const once = this.onceHandlers.get(event) ?? [];
		this.onceHandlers.delete(event);
		for (const cb of [...(this.handlers.get(event) ?? []), ...once]) {
			await cb();
		}
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

	it("exposes the maplibre namespace on the handle", async () => {
		const { handle } = await readyOutcome();
		expect(handle.maplibre.Map).toBe(
			FakeMap as unknown as typeof handle.maplibre.Map,
		);
	});

	it("runs overlays, first-load wiring, and the ready signal on load", async () => {
		const { fake, registerOverlays, onFirstLoad, onStyleReadyChange } =
			await readyOutcome();
		expect(registerOverlays).not.toHaveBeenCalled();

		await fake.fire("load");

		expect(registerOverlays).toHaveBeenCalledTimes(1);
		expect(onFirstLoad).toHaveBeenCalledTimes(1);
		expect(onStyleReadyChange).toHaveBeenLastCalledWith(true);
	});

	it("waits for an ASYNC registerOverlays before first-load wiring and ready", async () => {
		let resolveOverlays: () => void = () => {};
		const registerOverlays = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveOverlays = resolve;
				}),
		);
		const { fake, onFirstLoad, onStyleReadyChange } = await readyOutcome({
			registerOverlays,
		});

		const firing = fake.fire("load");
		// Overlays pending (sprite loads, layer install) — nothing downstream
		// may run yet
		expect(registerOverlays).toHaveBeenCalledTimes(1);
		expect(onFirstLoad).not.toHaveBeenCalled();
		expect(onStyleReadyChange).not.toHaveBeenCalled();

		resolveOverlays();
		await firing;
		expect(onFirstLoad).toHaveBeenCalledTimes(1);
		expect(onStyleReadyChange).toHaveBeenLastCalledWith(true);
	});

	it("swaps the style on a theme change and re-registers overlays on style.load", async () => {
		const { handle, fake, registerOverlays, onFirstLoad, onStyleReadyChange } =
			await readyOutcome();
		await fake.fire("load");

		handle.setTheme("dark");
		expect(onStyleReadyChange).toHaveBeenLastCalledWith(false);
		expect(fake.setStyleCalls).toEqual([styleUrlForTheme("dark")]);

		await fake.fire("style.load");
		expect(registerOverlays).toHaveBeenCalledTimes(2);
		// First-load wiring must NOT re-run on a style swap
		expect(onFirstLoad).toHaveBeenCalledTimes(1);
		expect(onStyleReadyChange).toHaveBeenLastCalledWith(true);
	});

	it("queues a pre-load theme change and ignores an unchanged theme", async () => {
		const { handle, fake } = await readyOutcome();

		// Not ready yet — the swap must not race the initial style load, but
		// it must not be dropped either
		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual([]);

		await fake.fire("load");
		expect(fake.setStyleCalls).toEqual([styleUrlForTheme("dark")]);

		await fake.fire("style.load");
		handle.setTheme("dark");
		expect(fake.setStyleCalls).toHaveLength(1);
	});

	it("treats undefined and light as the same theme — no restyle on resolve", async () => {
		// Callers may construct before the theme store resolves; undefined and
		// "light" map to the same style, so resolving must not restyle.
		const { handle, fake } = await readyOutcome({ theme: undefined });
		await fake.fire("load");

		handle.setTheme("light");
		expect(fake.setStyleCalls).toEqual([]);

		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual([styleUrlForTheme("dark")]);
	});

	it("queues a pick made mid-swap and applies it when the swap settles", async () => {
		const { handle, fake, registerOverlays } = await readyOutcome();
		await fake.fire("load");

		handle.setTheme("dark");
		// Second pick while dark's style is still loading: not applied yet —
		// but not dropped either (the picker UI already shows it selected)
		handle.setTheme("light");
		expect(fake.setStyleCalls).toEqual([styleUrlForTheme("dark")]);

		// The in-flight swap settles → the queued pick applies automatically
		await fake.fire("style.load");
		expect(fake.setStyleCalls).toEqual([
			styleUrlForTheme("dark"),
			styleUrlForTheme("light"),
		]);
		await fake.fire("style.load");
		// load + dark swap + queued light swap
		expect(registerOverlays).toHaveBeenCalledTimes(3);

		// And the queue drains fully: nothing further pending
		await fake.fire("style.load");
		expect(fake.setStyleCalls).toHaveLength(2);
	});

	it("uses the styles override pair in theme mode", async () => {
		// Narrowed param: the facade always normalizes before calling
		const styles = (t: "light" | "dark") =>
			t === "dark" ? "preview-dark" : "preview-light";
		const { handle, fake } = await readyOutcome({ styles, theme: "light" });
		expect(fake.ctorOptions.style).toBe("preview-light");

		await fake.fire("load");
		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual(["preview-dark"]);
	});

	it("explicit-style mode: caller owns swaps, setTheme is inert", async () => {
		const { handle, fake, registerOverlays } = await readyOutcome({
			style: "https://example.org/basemap.json",
		});
		expect(fake.ctorOptions.style).toBe("https://example.org/basemap.json");
		await fake.fire("load");

		// The theme machine is off — the basemap picker owns style selection
		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual([]);

		handle.setStyle("https://example.org/other.json");
		expect(fake.setStyleCalls).toEqual(["https://example.org/other.json"]);
		await fake.fire("style.load");
		expect(registerOverlays).toHaveBeenCalledTimes(2);
	});

	it("merges mapOptions over the defaults and can skip controls", async () => {
		const { fake } = await readyOutcome({
			controls: false,
			mapOptions: { interactive: false, center: [7, 46], zoom: 15 },
		});
		expect(fake.controlsAdded).toBe(0);
		expect(fake.ctorOptions.interactive).toBe(false);
		expect(fake.ctorOptions.center).toEqual([7, 46]);
		expect(fake.ctorOptions.zoom).toBe(15);
		// Defaults survive underneath the overrides
		expect(fake.ctorOptions.maxZoom).toBe(21);
	});

	it("destroy removes the map and inert-s the handle", async () => {
		const { handle, fake, registerOverlays } = await readyOutcome();
		await fake.fire("load");

		handle.destroy();
		expect(fake.removed).toBe(true);

		handle.setTheme("dark");
		expect(fake.setStyleCalls).toEqual([]);

		// A straggling event after teardown must not touch callbacks
		await fake.fire("style.load");
		expect(registerOverlays).toHaveBeenCalledTimes(1);
	});
});
