import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { mapUpdates, placesSyncCount } from "$lib/store";

// Mirrors /map's `dataRefresh` (src/lib/map/setup.ts:555): a button that
// stays hidden until a fresh sync arrives, then reveals itself and
// reloads the page on click. The reveal condition matches /map's
// reactive trigger in `+page.svelte:337`:
//     $mapUpdates && $placesSyncCount > 1
// Subscribing to both stores in onAdd keeps the visibility in sync;
// onRemove tears the subscriptions down.
export class DataRefreshControl implements IControl {
	#container: HTMLDivElement | undefined;
	#unsubs: Array<() => void> = [];

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";
		container.style.display = "none";

		const t = get(_);
		const label = t("mapControls.dataRefreshAvailable");

		const a = document.createElement("a");
		a.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		a.href = "#";
		a.title = label;
		a.setAttribute("role", "button");
		a.setAttribute("aria-label", label);
		a.setAttribute("aria-disabled", "false");

		const img = document.createElement("img");
		img.src = "/icons/refresh.svg";
		img.alt = t("mapControls.dataRefreshAlt");
		img.width = 16;
		img.height = 16;
		a.appendChild(img);

		a.addEventListener("click", (e) => {
			e.preventDefault();
			trackEvent("data_refresh_click");
			window.location.reload();
		});

		container.appendChild(a);

		const evaluateVisibility = () => {
			const visible = get(mapUpdates) && get(placesSyncCount) > 1;
			container.style.display = visible ? "block" : "none";
		};

		// Both subscribe() calls fire synchronously with the current value, so
		// initial visibility is set immediately — no separate init path needed.
		this.#unsubs.push(mapUpdates.subscribe(evaluateVisibility));
		this.#unsubs.push(placesSyncCount.subscribe(evaluateVisibility));

		this.#container = container;
		return container;
	}

	onRemove(): void {
		for (const u of this.#unsubs) u();
		this.#unsubs = [];
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
	}
}
