import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _, locale } from "$lib/i18n";

import "./controls.css";

// Toggle button that shows/hides the merchant-density heatmap layer.
// The page owns the actual layer visibility swap (it owns the layer
// itself), so this control only handles UI + persistence of the
// on/off choice in localStorage. Tooltip + aria-label re-render on
// locale change so the language toggle is reflected without a reload.
//
// Icon: the Material `whatshot` outline glyph (a flame — the
// conventional heatmap metaphor), inlined as SVG so it renders
// instantly with no extra request and recolours via the same
// dark-mode invert filter as the other anchor-based controls. This
// reuses the app's Material Icons set rather than introducing a new
// icon asset.
const HEATMAP_STORAGE_KEY = "btcmap:heatmap-layer";

const HEATMAP_ICON_SVG =
	'<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M11.57 13.16c-1.36.28-2.17 1.16-2.17 2.41c0 1.34 1.11 2.42 2.49 2.42c2.05 0 3.71-1.66 3.71-3.71c0-1.07-.15-2.12-.46-3.12c-.79 1.07-2.2 1.72-3.57 2M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73c-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67M12 20c-3.31 0-6-2.69-6-6c0-1.53.3-3.04.86-4.43a5.58 5.58 0 0 0 3.97 1.63c2.66 0 4.75-1.83 5.28-4.43A14.77 14.77 0 0 1 18 14c0 3.31-2.69 6-6 6"/></svg>';

export class HeatmapToggleControl implements IControl {
	#container: HTMLDivElement | undefined;
	#button: HTMLAnchorElement | undefined;
	#onToggle: (enabled: boolean) => void;
	#enabled: boolean;
	#unsubLocale: (() => void) | null = null;

	constructor(onToggle: (enabled: boolean) => void) {
		this.#onToggle = onToggle;
		this.#enabled =
			typeof window !== "undefined" &&
			localStorage.getItem(HEATMAP_STORAGE_KEY) === "true";
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";

		const a = document.createElement("a");
		a.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		a.href = "#";
		a.tabIndex = 0;
		a.setAttribute("role", "button");
		a.setAttribute("aria-disabled", "false");
		a.setAttribute("aria-pressed", String(this.#enabled));
		a.innerHTML = HEATMAP_ICON_SVG;

		a.addEventListener("click", (e) => {
			e.preventDefault();
			this.#enabled = !this.#enabled;
			this.#renderActive();
			try {
				localStorage.setItem(HEATMAP_STORAGE_KEY, String(this.#enabled));
			} catch {
				// localStorage may be unavailable (private mode); the
				// toggle still works for the session, just not persisted.
			}
			trackEvent("heatmap_layer_toggle", { enabled: this.#enabled });
			this.#onToggle(this.#enabled);
		});

		container.appendChild(a);
		this.#container = container;
		this.#button = a;

		this.#renderActive();

		const applyLabels = () => {
			const t = get(_);
			const label = t("mapControls.heatmap");
			a.title = label;
			a.setAttribute("aria-label", label);
		};
		// subscribe fires synchronously with the current locale so this also
		// handles initial render. The page applies the persisted on/off state
		// to the layer itself once the layer exists (in the map 'load'
		// handler), so onAdd does not call onToggle here — at addControl time
		// the heatmap layer has not been added yet.
		this.#unsubLocale = locale.subscribe(applyLabels);

		return container;
	}

	#renderActive() {
		if (!this.#button) return;
		this.#button.setAttribute("aria-pressed", String(this.#enabled));
		this.#button.style.opacity = this.#enabled ? "1" : "0.55";
		this.#button.style.backgroundColor = this.#enabled
			? "rgba(0, 0, 0, 0.08)"
			: "";
	}

	onRemove(): void {
		this.#unsubLocale?.();
		this.#unsubLocale = null;
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
		this.#button = undefined;
	}
}
