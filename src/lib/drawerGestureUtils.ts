// Pure utility functions for drawer gesture handling
// All functions are side-effect free and easily testable

import {
	DISTANCE_THRESHOLD,
	PEEK_HEIGHT,
	POSITION_THRESHOLD_PERCENT,
	VELOCITY_SAMPLE_COUNT,
	VELOCITY_THRESHOLD,
} from "./drawerConfig";

export interface SnapState {
	expanded: boolean;
	height: number;
}

export interface VelocityState {
	samples: number[];
	velocity: number;
	lastY: number;
	lastTime: number;
}

// Determines the snap state based on gesture velocity and distance
export function determineSnapState(
	velocity: number,
	totalDelta: number,
	finalHeight: number,
	expandedHeight: number,
): SnapState {
	// Velocity takes priority - flick gestures feel responsive
	if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
		if (velocity > 0) {
			return { expanded: true, height: expandedHeight };
		} else {
			return { expanded: false, height: PEEK_HEIGHT };
		}
	}

	// Then check distance for deliberate drags
	if (totalDelta > DISTANCE_THRESHOLD) {
		return { expanded: true, height: expandedHeight };
	}
	if (totalDelta < -DISTANCE_THRESHOLD) {
		return { expanded: false, height: PEEK_HEIGHT };
	}

	// Small movement - snap to nearest based on current position
	const threshold =
		PEEK_HEIGHT + (expandedHeight - PEEK_HEIGHT) * POSITION_THRESHOLD_PERCENT;
	if (finalHeight > threshold) {
		return { expanded: true, height: expandedHeight };
	}
	return { expanded: false, height: PEEK_HEIGHT };
}

// Updates velocity tracking state - returns new state without mutation
export function updateVelocity(
	currentY: number,
	currentTime: number,
	state: VelocityState,
): VelocityState {
	const timeDelta = currentTime - state.lastTime;
	if (timeDelta <= 0) {
		return { ...state, lastY: currentY, lastTime: currentTime };
	}

	const yDelta = state.lastY - currentY; // positive = moving up
	const instantVelocity = yDelta / timeDelta;

	const samples = [...state.samples, instantVelocity];
	if (samples.length > VELOCITY_SAMPLE_COUNT) {
		samples.shift();
	}

	const velocity = samples.reduce((a, b) => a + b, 0) / samples.length;

	return {
		samples,
		velocity,
		lastY: currentY,
		lastTime: currentTime,
	};
}

// Creates initial velocity tracking state
export function createVelocityState(
	initialY: number,
	initialTime: number,
): VelocityState {
	return {
		samples: [],
		velocity: 0,
		lastY: initialY,
		lastTime: initialTime,
	};
}

// Resets velocity tracking state (for reuse without allocation)
export function resetVelocityState(): VelocityState {
	return {
		samples: [],
		velocity: 0,
		lastY: 0,
		lastTime: 0,
	};
}

// Calculates new drawer height during drag
export function calculateDragHeight(
	startY: number,
	currentY: number,
	initialHeight: number,
	minHeight: number,
	maxHeight: number,
): number {
	const deltaY = startY - currentY;
	return Math.max(minHeight, Math.min(maxHeight, initialHeight + deltaY));
}
