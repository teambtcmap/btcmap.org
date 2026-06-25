import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { _, locale } from "$lib/i18n";

import "./controls.css";

// Sliders / "tune" glyph — the tools (layers & filters) trigger.
export const TUNE_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="2" y1="14" x2="6" y2="14"></line><line x1="10" y1="8" x2="14" y2="8"></line><line x1="18" y1="16" x2="22" y2="16"></line></svg>`;

// Hamburger glyph — the page-navigation menu trigger.
export const MENU_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;

type Options = {
	iconSvg: string;
	// i18n key for the button title / aria-label, re-translated on locale change.
	labelKey: string;
	onClick: () => void;
};

// A minimal MapLibre IControl: one icon button in the top-right control
// group that runs onClick. The popover content lives in Svelte-managed
// modals (MapToolsModal / MapMenuModal) — this just renders a native-looking
// trigger so it sits flush with zoom / locate / globe.
export class MapButtonControl implements IControl {
	#options: Options;
	#container: HTMLDivElement | undefined;
	#unsubLocale: (() => void) | null = null;

	constructor(options: Options) {
		this.#options = options;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";

		const button = document.createElement("a");
		button.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		button.href = "#";
		button.tabIndex = 0;
		button.setAttribute("role", "button");
		button.setAttribute("aria-haspopup", "dialog");
		button.innerHTML = this.#options.iconSvg;
		button.addEventListener("click", (e) => {
			e.preventDefault();
			this.#options.onClick();
		});
		container.appendChild(button);
		this.#container = container;

		// subscribe() fires synchronously, so this also sets the initial label.
		this.#unsubLocale = locale.subscribe(() => {
			const label = get(_)(this.#options.labelKey);
			button.title = label;
			button.setAttribute("aria-label", label);
		});

		return container;
	}

	onRemove(): void {
		this.#unsubLocale?.();
		this.#unsubLocale = null;
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
	}
}
