// Keeps Tab focus inside a modal surface (modals, the mobile list panel):
// call from a keydown handler with the surface's root element.

// Candidates; isTabStop below decides which ones Tab actually visits
const FOCUSABLE = [
	"button",
	"a[href]",
	"input",
	"select",
	"textarea",
	"[tabindex]",
].join(", ");

// Tab skips negative tabindex and disabled controls, including ones
// disabled through a <fieldset> (only :disabled catches those). Hidden
// breakpoint variants (display: none) have no client rects; visibility:
// hidden keeps the boxes, so check the computed (inherited) value too.
const isTabStop = (el: HTMLElement): boolean =>
	el.tabIndex >= 0 &&
	!el.matches(":disabled") &&
	el.getClientRects().length > 0 &&
	getComputedStyle(el).visibility !== "hidden";

const focusableIn = (root: HTMLElement): HTMLElement[] =>
	Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isTabStop);

export const trapTab = (event: KeyboardEvent, root: HTMLElement): void => {
	if (event.key !== "Tab") return;
	// Another open dialog holds focus (e.g. a Save prompt over the list
	// panel, wherever it sits in the DOM): Tab is that dialog's business
	const active = document.activeElement;
	const dialog = active?.closest('[aria-modal="true"]');
	if (dialog && dialog !== root) return;

	const items = focusableIn(root);
	if (!items.length) return;

	const first = items[0];
	const last = items[items.length - 1];
	const inside = active instanceof Node && root.contains(active);

	if (!inside) {
		event.preventDefault();
		(event.shiftKey ? last : first).focus();
	} else if (event.shiftKey && active === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && active === last) {
		event.preventDefault();
		first.focus();
	}
};
