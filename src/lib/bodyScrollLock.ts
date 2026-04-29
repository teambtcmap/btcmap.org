// Ref-counted body scroll lock so multiple components can independently
// lock/unlock without clobbering each other.
let lockCount = 0;

export function lockBodyScroll(): void {
	if (typeof document === "undefined") return;
	if (lockCount === 0) {
		document.body.style.overflow = "hidden";
	}
	lockCount++;
}

export function unlockBodyScroll(): void {
	if (typeof document === "undefined") return;
	if (lockCount <= 0) return;
	lockCount--;
	if (lockCount === 0) {
		document.body.style.overflow = "";
	}
}
