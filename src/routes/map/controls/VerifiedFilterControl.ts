import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { VerifiedFilterYears } from "$lib/map/verifiedFilter";
import { VERIFIED_FILTER_OPTIONS } from "$lib/map/verifiedFilter";

import "./controls.css";

type Options = {
	initial: VerifiedFilterYears;
	// Apply the chosen filter. The page owns the effect (re-syncing markers +
	// refreshing the nearby list); this control handles only UI + persistence.
	// Returns a promise so the button can show a spinner during the one-time
	// on-demand date fetch on first activation.
	onSelect: (years: VerifiedFilterYears) => void | Promise<void>;
};

// Encode the nullable filter value as a radio value string ("any" | "1"…).
const toRadioValue = (years: VerifiedFilterYears): string =>
	years == null ? "any" : String(years);

// "Verified within N years" filter — a clock-icon button that expands into a
// radio list (Any / 1 / 2 / 3 years), mirroring BasemapsControl. Selecting an
// option persists the choice and delegates the effect to the page's onSelect.
export class VerifiedFilterControl implements IControl {
	#options: Options;
	#container: HTMLDivElement | undefined;
	#button: HTMLAnchorElement | undefined;
	#popup: HTMLDivElement | undefined;
	#current: VerifiedFilterYears;
	#unsubLocale: (() => void) | null = null;
	#docClickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(options: Options) {
		this.#options = options;
		this.#current = options.initial;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className =
			"maplibregl-ctrl maplibregl-ctrl-group maplibre-next-verified";

		const button = document.createElement("a");
		button.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		button.href = "#";
		button.tabIndex = 0;
		button.setAttribute("role", "button");
		button.setAttribute("aria-haspopup", "true");
		button.setAttribute("aria-expanded", "false");

		// Inline SVG: clock / "schedule" glyph. stroke="currentColor" so the
		// dark-mode invert rule in controls.css applies like BasemapsControl.
		button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>`;

		button.addEventListener("click", (e) => {
			e.preventDefault();
			this.#toggle();
		});
		container.appendChild(button);

		// Reuse the basemap picker's popup/option styles for layout parity.
		const popup = document.createElement("div");
		popup.className = "maplibre-next-basemaps-popup";
		popup.setAttribute("role", "radiogroup");
		popup.hidden = true;
		container.appendChild(popup);

		this.#container = container;
		this.#button = button;
		this.#popup = popup;

		this.#renderPopup();
		this.#updateActive();

		// Re-render labels when the locale changes.
		this.#unsubLocale = _.subscribe(() => this.#renderPopup());

		// Click anywhere outside the control closes the popup.
		this.#docClickHandler = (e) => {
			if (!this.#container?.contains(e.target as Node)) this.#close();
		};
		document.addEventListener("click", this.#docClickHandler);

		return container;
	}

	onRemove(): void {
		this.#unsubLocale?.();
		this.#unsubLocale = null;
		if (this.#docClickHandler) {
			document.removeEventListener("click", this.#docClickHandler);
			this.#docClickHandler = null;
		}
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
		this.#button = undefined;
		this.#popup = undefined;
	}

	#renderPopup(): void {
		if (!this.#popup) return;
		this.#popup.innerHTML = "";
		const groupName = `maplibre-next-verified-${Math.random().toString(36).slice(2, 8)}`;
		const t = get(_);
		for (const option of VERIFIED_FILTER_OPTIONS) {
			const label = document.createElement("label");
			label.className = "maplibre-next-basemaps-option";

			const radio = document.createElement("input");
			radio.type = "radio";
			radio.name = groupName;
			radio.value = toRadioValue(option.value);
			radio.checked = option.value === this.#current;
			radio.addEventListener("change", () => {
				if (radio.checked) void this.#select(option.value);
			});

			const text = document.createElement("span");
			text.textContent = t(option.labelKey);

			label.appendChild(radio);
			label.appendChild(text);
			this.#popup.appendChild(label);
		}

		const title = t("mapControls.verifiedFilterTitle", {
			default: "Only show verified places",
		});
		this.#button?.setAttribute("title", title);
		this.#button?.setAttribute("aria-label", title);
	}

	async #select(years: VerifiedFilterYears): Promise<void> {
		this.#current = years;
		this.#updateActive();
		// Persistence is owned by the merchant store (setVerifiedFilter, invoked
		// via onSelect) — don't write localStorage here too.
		trackEvent("verified_filter_change", { years: toRadioValue(years) });
		this.#close();
		// Spinner covers the one-time on-demand date fetch; instant (invisible)
		// once the dates are already loaded.
		this.#setLoading(true);
		try {
			await this.#options.onSelect(years);
		} finally {
			this.#setLoading(false);
		}
	}

	#setLoading(on: boolean): void {
		this.#container?.classList.toggle("loading", on);
		this.#button?.setAttribute("aria-busy", on ? "true" : "false");
	}

	#updateActive(): void {
		// Visual cue on the closed button that a window is active. The filter
		// hides places and persists across sessions, so a returning user needs
		// to see why the map is sparse.
		this.#container?.classList.toggle("active", this.#current != null);
	}

	#toggle(): void {
		if (!this.#popup) return;
		if (this.#popup.hidden) this.#open();
		else this.#close();
	}

	#open(): void {
		if (!this.#popup || !this.#button) return;
		this.#popup.hidden = false;
		this.#button.setAttribute("aria-expanded", "true");
	}

	#close(): void {
		if (!this.#popup || !this.#button) return;
		this.#popup.hidden = true;
		this.#button.setAttribute("aria-expanded", "false");
	}
}
