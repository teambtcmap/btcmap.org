// Store-based gesture controller for mobile drawer
// Consolidates all gesture state and handlers in one place

import { spring } from "svelte/motion";
import { derived, get, writable } from "svelte/store";

import { trackEvent } from "$lib/analytics";

import {
	DISMISS_THRESHOLD,
	PEEK_HEIGHT,
	SCROLL_DRAG_THRESHOLD,
	SCROLL_TOP_THRESHOLD,
	SPRING_CONFIG,
	VELOCITY_THRESHOLD,
} from "./drawerConfig";
import {
	createVelocityState,
	determineSnapState,
	updateVelocity,
	type VelocityState,
} from "./drawerGestureUtils";

export interface DrawerGestureState {
	expanded: boolean;
	isDragging: boolean;
	expandedHeight: number;
}

interface InternalGestureState {
	activePointerId: number | null;
	startY: number;
	initialHeight: number;
	velocityState: VelocityState;
	touchStartY: number | null;
	isInCollapseDrag: boolean;
}

function createDrawerGestureController() {
	// Public state (exposed to component)
	const expanded = writable(false);
	const isDragging = writable(false);
	const expandedHeight = writable(500);

	// Spring-animated height
	const drawerHeight = spring(PEEK_HEIGHT, SPRING_CONFIG);

	// Internal gesture tracking (not exposed)
	const internal: InternalGestureState = {
		activePointerId: null,
		startY: 0,
		initialHeight: PEEK_HEIGHT,
		velocityState: createVelocityState(0, 0),
		touchStartY: null,
		isInCollapseDrag: false,
	};

	// Callbacks for external actions
	let onDismiss: (() => void) | null = null;

	// Reset internal state
	function resetInternalState() {
		internal.activePointerId = null;
		internal.startY = 0;
		internal.velocityState = createVelocityState(0, 0);
		internal.touchStartY = null;
		internal.isInCollapseDrag = false;
		isDragging.set(false);
	}

	// Pointer event handlers (for handle/peek area)
	function handlePointerDown(
		event: PointerEvent,
		captureTarget: HTMLElement | null,
	) {
		if (internal.activePointerId !== null) return;

		internal.activePointerId = event.pointerId;
		isDragging.set(true);
		internal.startY = event.clientY;
		internal.initialHeight = get(drawerHeight);
		internal.velocityState = createVelocityState(
			event.clientY,
			event.timeStamp,
		);

		if (captureTarget) {
			try {
				captureTarget.setPointerCapture(event.pointerId);
			} catch {
				// Pointer capture not supported or failed
			}
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== internal.activePointerId || !get(isDragging))
			return;

		const currentY = event.clientY;
		internal.velocityState = updateVelocity(
			currentY,
			event.timeStamp,
			internal.velocityState,
		);

		const isExpanded = get(expanded);
		const maxHeight = get(expandedHeight);
		const deltaY = internal.startY - currentY;
		const minHeight = isExpanded ? PEEK_HEIGHT : 0;
		const newHeight = Math.max(
			minHeight,
			Math.min(maxHeight, internal.initialHeight + deltaY),
		);

		drawerHeight.set(newHeight, { hard: true });
	}

	function handlePointerUp(
		event: PointerEvent,
		capturedElement: HTMLElement | null,
	) {
		if (event.pointerId !== internal.activePointerId) return;

		const finalHeight = get(drawerHeight);
		const totalDelta = finalHeight - internal.initialHeight;
		const isExpanded = get(expanded);
		const maxHeight = get(expandedHeight);

		// Release pointer capture safely
		if (capturedElement) {
			try {
				capturedElement.releasePointerCapture(event.pointerId);
			} catch {
				// Already released or invalid
			}
		}

		// Check for dismiss gesture when in peek state
		const velocity = internal.velocityState.velocity;
		const shouldDismiss =
			!isExpanded &&
			(velocity < -VELOCITY_THRESHOLD ||
				finalHeight < PEEK_HEIGHT - DISMISS_THRESHOLD);

		if (shouldDismiss) {
			trackEvent("drawer_swipe_dismiss");
			onDismiss?.();
		} else {
			const snapState = determineSnapState(
				velocity,
				totalDelta,
				finalHeight,
				maxHeight,
			);
			// Track swipe expand/collapse only when state changes
			if (snapState.expanded !== isExpanded) {
				trackEvent(
					snapState.expanded ? "drawer_swipe_expand" : "drawer_swipe_collapse",
				);
			}
			expanded.set(snapState.expanded);
			drawerHeight.set(snapState.height);
		}

		resetInternalState();
	}

	function handlePointerCancel(event: PointerEvent) {
		if (event.pointerId !== internal.activePointerId) return;

		const isExpanded = get(expanded);
		const maxHeight = get(expandedHeight);

		// Snap back to previous state
		drawerHeight.set(isExpanded ? maxHeight : PEEK_HEIGHT);
		resetInternalState();
	}

	// Touch event handlers (for expanded content area - Google Maps style)
	function handleContentTouchStart(event: TouchEvent) {
		if (!get(expanded) || event.touches.length !== 1) return;
		internal.touchStartY = event.touches[0].clientY;
		internal.isInCollapseDrag = false;
	}

	function handleContentTouchMove(event: TouchEvent, scrollTop: number) {
		if (
			!get(expanded) ||
			internal.touchStartY === null ||
			event.touches.length !== 1
		)
			return;

		const touch = event.touches[0];
		const deltaY = touch.clientY - internal.touchStartY;

		// At scroll top AND dragging down → enter collapse drag mode
		if (scrollTop <= SCROLL_TOP_THRESHOLD && deltaY > SCROLL_DRAG_THRESHOLD) {
			event.preventDefault();

			if (!internal.isInCollapseDrag) {
				internal.isInCollapseDrag = true;
				isDragging.set(true);
				internal.startY = touch.clientY;
				internal.touchStartY = touch.clientY;
				internal.initialHeight = get(drawerHeight);
				internal.velocityState = createVelocityState(
					touch.clientY,
					event.timeStamp,
				);
			} else {
				const currentY = touch.clientY;
				internal.velocityState = updateVelocity(
					currentY,
					event.timeStamp,
					internal.velocityState,
				);

				const maxHeight = get(expandedHeight);
				const dragDelta = internal.startY - currentY;
				const newHeight = Math.max(
					PEEK_HEIGHT,
					Math.min(maxHeight, internal.initialHeight + dragDelta),
				);
				drawerHeight.set(newHeight, { hard: true });
			}
		} else if (internal.isInCollapseDrag && scrollTop > SCROLL_TOP_THRESHOLD) {
			// User scrolled back up during collapse drag - cancel it
			internal.isInCollapseDrag = false;
			isDragging.set(false);
			internal.velocityState = createVelocityState(0, 0);
			drawerHeight.set(get(expandedHeight));
		}
	}

	function handleContentTouchEnd() {
		if (internal.isInCollapseDrag) {
			const finalHeight = get(drawerHeight);
			const totalDelta = finalHeight - internal.initialHeight;
			const maxHeight = get(expandedHeight);
			const velocity = internal.velocityState.velocity;
			const snapState = determineSnapState(
				velocity,
				totalDelta,
				finalHeight,
				maxHeight,
			);
			// Track collapse from content swipe (can only collapse, not expand, from content drag)
			if (!snapState.expanded) {
				trackEvent("drawer_swipe_collapse");
			}
			expanded.set(snapState.expanded);
			drawerHeight.set(snapState.height);
		}
		resetInternalState();
	}

	// Public methods for drawer control
	function expand() {
		expanded.set(true);
		drawerHeight.set(get(expandedHeight));
	}

	function collapse() {
		expanded.set(false);
		drawerHeight.set(PEEK_HEIGHT);
	}

	function toggle() {
		if (get(expanded)) {
			collapse();
		} else {
			expand();
		}
	}

	function resetToPeek() {
		expanded.set(false);
		drawerHeight.set(PEEK_HEIGHT, { hard: true });
		resetInternalState();
	}

	function setExpandedHeight(height: number) {
		expandedHeight.set(height);
		if (get(expanded)) {
			drawerHeight.set(height);
		}
	}

	function setDismissCallback(callback: (() => void) | null) {
		onDismiss = callback;
	}

	// Derived store for component binding
	const state = derived(
		[expanded, isDragging, expandedHeight],
		([$expanded, $isDragging, $expandedHeight]) => ({
			expanded: $expanded,
			isDragging: $isDragging,
			expandedHeight: $expandedHeight,
		}),
	);

	return {
		// Stores
		expanded,
		isDragging,
		expandedHeight,
		drawerHeight,
		state,

		// Pointer handlers
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handlePointerCancel,

		// Touch handlers
		handleContentTouchStart,
		handleContentTouchMove,
		handleContentTouchEnd,

		// Control methods
		expand,
		collapse,
		toggle,
		resetToPeek,
		setExpandedHeight,
		setDismissCallback,
	};
}

// Export singleton instance
export const drawerGesture = createDrawerGestureController();

// Export type for component usage
export type DrawerGestureController = ReturnType<
	typeof createDrawerGestureController
>;
