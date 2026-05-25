import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _, locale } from "$lib/i18n";
import { session } from "$lib/session";

// Mirrors /map's `homeMarkerButtons` (src/lib/map/setup.ts) as a
// MapLibre custom IControl. Two variants:
//  - "main": home → add-location → community map → account (used by /map)
//  - "communities": home → merchant map → account (used by /communities/map)
// The account button is session- and locale-reactive — subscribed in
// onAdd, unsubscribed in onRemove.
export type NavButtonsVariant = "main" | "communities";

export class NavButtonsControl implements IControl {
	#variant: NavButtonsVariant;
	#container: HTMLDivElement | undefined;
	#unsubs: Array<() => void> = [];

	constructor(variant: NavButtonsVariant = "main") {
		this.#variant = variant;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";

		const t = get(_);

		// Home
		const homeBtn = this.#createButton({
			href: "/",
			title: t("mapControls.goToHome"),
			iconSrc: "/icons/home.svg",
			iconAlt: t("mapControls.goToHomeAlt"),
			onClick: () => trackEvent("home_button_click"),
		});
		container.appendChild(homeBtn);

		if (this.#variant === "main") {
			// Add location
			const addLocBtn = this.#createButton({
				href: "/add-location",
				title: t("mapControls.addLocation"),
				iconSrc: "/icons/marker.svg",
				iconAlt: t("mapControls.addLocationAlt"),
				onClick: () => trackEvent("add_location_click"),
			});
			container.appendChild(addLocBtn);

			// Community map
			const commBtn = this.#createButton({
				href: "/communities/map",
				title: t("mapControls.communityMap"),
				iconSrc: "/icons/group.svg",
				iconAlt: t("mapControls.communityMapAlt"),
				onClick: () => trackEvent("community_map_click"),
			});
			container.appendChild(commBtn);
		} else {
			// Merchant map (back to /map from the community map)
			const merchantBtn = this.#createButton({
				href: "/map",
				title: t("mapControls.merchantMap"),
				iconSrc: "/icons/shopping.svg",
				iconAlt: t("mapControls.merchantMapAlt"),
				onClick: () => {},
			});
			container.appendChild(merchantBtn);
		}

		// Account / Log in — href + labels driven by session/locale subscriptions
		// so the button stays correct after in-place auth flows (no reload).
		const accountBtn = document.createElement("a");
		accountBtn.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		accountBtn.setAttribute("role", "button");
		const accountImg = document.createElement("img");
		accountImg.src = "/icons/account.svg";
		accountImg.width = 16;
		accountImg.height = 16;
		accountBtn.appendChild(accountImg);
		accountBtn.addEventListener("click", () => {
			trackEvent("account_button_click", { logged_in: !!get(session) });
		});
		container.appendChild(accountBtn);

		const updateAccount = () => {
			const loggedIn = !!get(session);
			const tt = get(_);
			const title = loggedIn
				? tt("mapControls.account")
				: tt("mapControls.login");
			accountBtn.href = loggedIn ? "/user/activity" : "/login";
			accountBtn.title = title;
			accountBtn.setAttribute("aria-label", title);
			accountImg.alt = loggedIn
				? tt("mapControls.accountAlt")
				: tt("mapControls.loginAlt");
		};

		// subscribe() fires synchronously with the current value, so this
		// also handles initial render — no separate init path needed.
		this.#unsubs.push(session.subscribe(updateAccount));
		this.#unsubs.push(locale.subscribe(updateAccount));

		this.#container = container;
		return container;
	}

	onRemove(): void {
		for (const u of this.#unsubs) u();
		this.#unsubs = [];
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
	}

	#createButton(opts: {
		href: string;
		title: string;
		iconSrc: string;
		iconAlt: string;
		onClick: () => void;
	}): HTMLAnchorElement {
		const a = document.createElement("a");
		a.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		a.href = opts.href;
		a.title = opts.title;
		a.setAttribute("role", "button");
		a.setAttribute("aria-label", opts.title);
		const img = document.createElement("img");
		img.src = opts.iconSrc;
		img.alt = opts.iconAlt;
		img.width = 16;
		img.height = 16;
		a.appendChild(img);
		a.addEventListener("click", opts.onClick);
		return a;
	}
}
