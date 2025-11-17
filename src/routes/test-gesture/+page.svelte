<script lang="ts">
	import { spring } from 'svelte/motion';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Constants - extracted for easy tuning
	const PEEK_HEIGHT = 120;
	const VELOCITY_THRESHOLD = 0.5; // px/ms - fast flick detection
	const DISTANCE_THRESHOLD = 80; // px - significant drag
	const POSITION_THRESHOLD_PERCENT = 0.3; // 30% of travel for snap decision
	const VELOCITY_SAMPLE_COUNT = 5;

	// Spring configuration - tuned for snappy but smooth animation
	const SPRING_CONFIG = { stiffness: 0.2, damping: 0.75 };

	// Dynamic state
	let FULL_HEIGHT = 500;
	let height = spring(PEEK_HEIGHT, SPRING_CONFIG);
	let expanded = false;
	let isDragging = false;
	let logs: string[] = [];

	// Pointer tracking state
	let activePointerId: number | null = null;
	let startY = 0;
	let initialHeight = PEEK_HEIGHT;
	let lastY = 0;
	let lastTime = 0;
	let velocitySamples: number[] = [];
	let velocity = 0;

	// DOM references
	let handleElement: HTMLDivElement;
	let contentElement: HTMLDivElement;

	onMount(() => {
		if (browser) {
			FULL_HEIGHT = window.innerHeight;

			const updateHeight = () => {
				FULL_HEIGHT = window.innerHeight;
				if (expanded) {
					height.set(FULL_HEIGHT);
				}
			};

			window.addEventListener('resize', updateHeight);
			return () => window.removeEventListener('resize', updateHeight);
		}
	});

	function log(message: string) {
		const timestamp = new Date().toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 2
		});
		logs = [`[${timestamp}] ${message}`, ...logs].slice(0, 20);
		console.info(message);
	}

	function handlePointerDown(event: PointerEvent) {
		// Only track one pointer at a time
		if (activePointerId !== null) return;

		activePointerId = event.pointerId;
		isDragging = true;
		startY = event.clientY;
		initialHeight = $height;
		lastY = event.clientY;
		lastTime = Date.now();
		velocitySamples = [];
		velocity = 0;

		// Capture pointer to receive events even if pointer leaves element
		if (handleElement) {
			try {
				handleElement.setPointerCapture(event.pointerId);
			} catch (e) {
				log(`Warning: Could not capture pointer: ${e}`);
			}
		}

		log(`Pointer down: screenY=${Math.round(startY)}, height=${Math.round(initialHeight)}`);
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointerId || !isDragging) return;

		const currentY = event.clientY;
		const currentTime = Date.now();

		// Calculate instantaneous velocity
		const timeDelta = currentTime - lastTime;
		if (timeDelta > 0) {
			const yDelta = lastY - currentY; // positive = moving up
			const instantVelocity = yDelta / timeDelta;

			// Keep last N samples for smoothing
			velocitySamples.push(instantVelocity);
			if (velocitySamples.length > VELOCITY_SAMPLE_COUNT) {
				velocitySamples.shift();
			}
			velocity = velocitySamples.reduce((a, b) => a + b, 0) / velocitySamples.length;
		}

		lastY = currentY;
		lastTime = currentTime;

		// Calculate new height - 1:1 tracking with finger
		const deltaY = startY - currentY;
		const newHeight = Math.max(PEEK_HEIGHT, Math.min(FULL_HEIGHT, initialHeight + deltaY));

		log(
			`Move: delta=${Math.round(deltaY)}px, vel=${velocity.toFixed(2)}px/ms, h=${Math.round(newHeight)}`
		);
		height.set(newHeight, { hard: true });
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.pointerId !== activePointerId) return;

		const finalHeight = $height;
		const totalDelta = finalHeight - initialHeight;

		log(`Pointer up: totalDelta=${Math.round(totalDelta)}px, velocity=${velocity.toFixed(2)}px/ms`);

		// Release pointer capture safely
		if (handleElement) {
			try {
				handleElement.releasePointerCapture(event.pointerId);
			} catch {
				// Already released or invalid - safe to ignore
			}
		}
		activePointerId = null;
		isDragging = false;

		// Snap decision based on velocity first, then distance
		if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
			// Fast flick - use velocity direction
			if (velocity > 0) {
				log('→ Fast flick UP → expanding');
				expanded = true;
				height.set(FULL_HEIGHT);
			} else {
				log('→ Fast flick DOWN → collapsing');
				expanded = false;
				height.set(PEEK_HEIGHT);
			}
		} else if (totalDelta > DISTANCE_THRESHOLD) {
			log('→ Drag UP past threshold → expanding');
			expanded = true;
			height.set(FULL_HEIGHT);
		} else if (totalDelta < -DISTANCE_THRESHOLD) {
			log('→ Drag DOWN past threshold → collapsing');
			expanded = false;
			height.set(PEEK_HEIGHT);
		} else {
			// Small movement - snap to nearest based on current position
			const threshold = PEEK_HEIGHT + (FULL_HEIGHT - PEEK_HEIGHT) * POSITION_THRESHOLD_PERCENT;
			if (finalHeight > threshold) {
				log(`→ Position above ${POSITION_THRESHOLD_PERCENT * 100}% → expanding`);
				expanded = true;
				height.set(FULL_HEIGHT);
			} else {
				log(`→ Position below ${POSITION_THRESHOLD_PERCENT * 100}% → collapsing`);
				expanded = false;
				height.set(PEEK_HEIGHT);
			}
		}

		// Reset velocity
		velocity = 0;
		velocitySamples = [];
	}

	function handlePointerCancel(event: PointerEvent) {
		if (event.pointerId !== activePointerId) return;

		log('Pointer cancelled - resetting');
		activePointerId = null;
		isDragging = false;

		// Snap back to previous state
		if (expanded) {
			height.set(FULL_HEIGHT);
		} else {
			height.set(PEEK_HEIGHT);
		}
	}

	// Keyboard support for accessibility
	function handleKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'Enter':
			case ' ':
				event.preventDefault();
				// Toggle expanded state
				if (expanded) {
					expanded = false;
					height.set(PEEK_HEIGHT);
					log('Keyboard: collapsed');
				} else {
					expanded = true;
					height.set(FULL_HEIGHT);
					log('Keyboard: expanded');
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (!expanded) {
					expanded = true;
					height.set(FULL_HEIGHT);
					log('Keyboard: ArrowUp → expanded');
				}
				break;
			case 'ArrowDown':
				event.preventDefault();
				if (expanded) {
					expanded = false;
					height.set(PEEK_HEIGHT);
					log('Keyboard: ArrowDown → collapsed');
				}
				break;
			case 'Escape':
				event.preventDefault();
				if (expanded) {
					expanded = false;
					height.set(PEEK_HEIGHT);
					log('Keyboard: Escape → collapsed');
				}
				break;
		}
	}
</script>

<div class="poc-container">
	<h1>Bottom Sheet POC - Pointer Events</h1>
	<p>True 1:1 finger tracking using raw Pointer Events API</p>

	<!-- Debug logs -->
	<div class="log-panel" aria-hidden="true">
		<strong>Event Log:</strong>
		{#each logs as logEntry, i (i)}
			<div>{logEntry}</div>
		{:else}
			<div>Drag the handle bar to see events</div>
		{/each}
	</div>

	<!-- Instructions -->
	<div class="instructions">
		<strong>How it works:</strong>
		<ul>
			<li><strong>Drag handle</strong> - Sheet follows your finger 1:1</li>
			<li><strong>Fast flick</strong> - Snaps based on velocity (>{VELOCITY_THRESHOLD} px/ms)</li>
			<li><strong>Slow drag</strong> - Snaps if moved >{DISTANCE_THRESHOLD}px</li>
			<li>
				<strong>Small movement</strong> - Snaps to nearest ({POSITION_THRESHOLD_PERCENT * 100}%
				threshold)
			</li>
			<li><strong>Keyboard</strong> - Enter/Space toggle, Arrow keys, Escape to close</li>
		</ul>
		<div class="status">
			State: <strong>{expanded ? 'EXPANDED' : 'PEEK'}</strong> | Height:
			<strong>{Math.round($height)}px</strong>
			| Dragging: <strong>{isDragging ? 'YES' : 'NO'}</strong>
		</div>
	</div>

	<!-- Bottom sheet drawer -->
	<div
		class="drawer"
		style="height: {$height}px;"
		role="dialog"
		aria-modal={expanded}
		aria-label="Bottom sheet drawer"
		id="bottom-sheet"
	>
		<!-- Drag handle - this is the interactive area -->
		<div
			class="handle"
			class:dragging={isDragging}
			bind:this={handleElement}
			on:pointerdown={handlePointerDown}
			on:pointermove={handlePointerMove}
			on:pointerup={handlePointerUp}
			on:pointercancel={handlePointerCancel}
			on:keydown={handleKeydown}
			tabindex="0"
			role="button"
			aria-label={expanded ? 'Collapse drawer' : 'Expand drawer'}
			aria-controls="bottom-sheet-content"
			aria-expanded={expanded}
		>
			<div class="handle-bar"></div>
			{#if isDragging}
				<span class="handle-text">↕ DRAGGING ↕</span>
			{:else if expanded}
				<span class="handle-text">⬇ Drag down to collapse</span>
			{:else}
				<span class="handle-text">⬆ Drag up to expand</span>
			{/if}
		</div>

		<!-- Content area -->
		<div class="content" bind:this={contentElement} id="bottom-sheet-content">
			{#if expanded}
				<h2>Full View</h2>
				<div class="stats">
					<p>Peek: {PEEK_HEIGHT}px | Full: {FULL_HEIGHT}px</p>
					<p>Last velocity: {velocity.toFixed(3)} px/ms</p>
					<p>
						Thresholds: vel={VELOCITY_THRESHOLD}px/ms, dist={DISTANCE_THRESHOLD}px, pos={POSITION_THRESHOLD_PERCENT *
							100}%
					</p>
					<p>Spring: stiffness={SPRING_CONFIG.stiffness}, damping={SPRING_CONFIG.damping}</p>
				</div>
				<div class="scroll-content">
					<p>Scrollable content:</p>
					{#each Array(30) as _, i (i)}
						<p>Item {i + 1} - Lorem ipsum dolor sit amet consectetur</p>
					{/each}
				</div>
			{:else}
				<div class="peek-content">
					<p><strong>Peek View</strong></p>
					<p class="hint">Drag up for full content</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.poc-container {
		padding: 20px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
		height: 100vh;
		position: relative;
		background: #f5f5f5;
	}

	h1 {
		margin: 0 0 10px 0;
		font-size: 24px;
	}

	.log-panel {
		margin: 15px 0;
		padding: 10px;
		background: #1a1a1a;
		color: #00ff00;
		font-size: 11px;
		font-family: 'Courier New', monospace;
		max-height: 200px;
		overflow-y: auto;
		border-radius: 4px;
	}

	.instructions {
		margin-top: 15px;
		padding: 12px;
		background: #fffbcc;
		border: 1px solid #e6d98c;
		border-radius: 4px;
		font-size: 14px;
	}

	.instructions ul {
		margin: 8px 0;
		padding-left: 20px;
	}

	.instructions li {
		margin: 4px 0;
	}

	.status {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid #e6d98c;
		font-size: 13px;
	}

	.drawer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: white;
		border-top-left-radius: 16px;
		border-top-right-radius: 16px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.handle {
		width: 100%;
		padding: 12px 0 8px 0;
		background: #f8f8f8;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: grab;
		user-select: none;
		touch-action: none;
		flex-shrink: 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.handle:focus {
		outline: 2px solid #0088ff;
		outline-offset: -2px;
	}

	.handle:active,
	.handle.dragging {
		cursor: grabbing;
		background: #e8f4ff;
	}

	.handle-bar {
		width: 40px;
		height: 4px;
		background: #ccc;
		border-radius: 2px;
		margin-bottom: 8px;
	}

	.handle.dragging .handle-bar {
		background: #0088ff;
	}

	.handle-text {
		font-size: 12px;
		color: #666;
		font-weight: 500;
	}

	.content {
		padding: 16px;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.peek-content {
		text-align: center;
		padding: 10px;
	}

	.peek-content .hint {
		font-size: 12px;
		color: #888;
		margin-top: 4px;
	}

	.stats {
		background: #f0f0f0;
		padding: 10px;
		border-radius: 4px;
		font-size: 12px;
		margin: 10px 0;
	}

	.stats p {
		margin: 4px 0;
	}

	.scroll-content {
		margin-top: 15px;
	}

	.scroll-content p {
		margin: 8px 0;
		padding: 8px;
		background: #fafafa;
		border-radius: 4px;
	}
</style>
