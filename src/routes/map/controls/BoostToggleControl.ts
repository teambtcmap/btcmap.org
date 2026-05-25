import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _, locale } from "$lib/i18n";

// Mirrors /map's BoostControl (MapControls.svelte:20-81): a single
// ctrl-group with one anchor that toggles the `?boosts=true` URL param.
// Click triggers a full page reload via `location.search = …`, matching
// /map's behavior — no live URL listener needed. Tooltip + alt re-render
// on locale change so the language toggle is reflected without a reload.
export class BoostToggleControl implements IControl {
	#container: HTMLDivElement | undefined;
	#unsubLocale: (() => void) | null = null;

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";

		const boostsActive =
			typeof window !== "undefined" &&
			new URLSearchParams(window.location.search).has("boosts");

		const a = document.createElement("a");
		a.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		a.href = "#";
		a.tabIndex = 0;
		a.setAttribute("role", "button");
		a.setAttribute("aria-disabled", "false");

		const img = document.createElement("img");
		img.src = boostsActive ? "/icons/boost-solid.svg" : "/icons/boost.svg";
		img.width = 16;
		img.height = 16;
		a.appendChild(img);

		a.addEventListener("click", (e) => {
			e.preventDefault();
			trackEvent("boost_layer_toggle");
			const currentUrl = new URL(window.location.href);
			if (currentUrl.searchParams.has("boosts")) {
				currentUrl.searchParams.delete("boosts");
			} else {
				currentUrl.searchParams.set("boosts", "true");
			}
			window.location.search = currentUrl.search;
		});

		container.appendChild(a);
		this.#container = container;

		const applyLabels = () => {
			const t = get(_);
			const label = t("boost.locations");
			a.title = label;
			a.setAttribute("aria-label", label);
			img.alt = t("mapControls.boostAlt");
		};
		// subscribe fires synchronously with the current locale so this also
		// handles initial render.
		this.#unsubLocale = locale.subscribe(applyLabels);

		return container;
	}

	onRemove(): void {
		this.#unsubLocale?.();
		this.#unsubLocale = null;
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
	}
}
