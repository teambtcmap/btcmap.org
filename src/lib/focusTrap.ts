// Keeps Tab focus inside a modal surface (e.g. the place photo viewer):
// call from a keydown handler with the surface's root element.

const FOCUSABLE = [
	"button:not([disabled])",
	"a[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(", ");

// Rendered elements only: hidden breakpoint variants (display: none) have
// no client rects
const focusableIn = (root: HTMLElement): HTMLElement[] =>
	Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => el.getClientRects().length > 0,
	);

export const trapTab = (event: KeyboardEvent, root: HTMLElement): void => {
	if (event.key !== "Tab") return;
	const items = focusableIn(root);
	if (!items.length) return;

	const first = items[0];
	const last = items[items.length - 1];
	const active = document.activeElement;
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
