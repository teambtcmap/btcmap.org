<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	// To use it as HTML `class` attr
	let className = '';
	export { className as class };

	// Some DOM elements to exclude them from triggering the `outclick` event
	export let excludeByDOMNode = [];
	export let excludeByQuerySelector = [];

	// Whether to not use CSS `display: contents` to ignore the wrapper element or not
	export let useWrapper = false;

	// Whether the component content can contain the event's target or not
	export let includeSelf = false;

	// DOM element that wraps all stuff that goes inside the component's <slot />
	let wrapper;

	// Whether the excluded elements contain the event's target or not
	const isClickedOnExcluded = (eventTarget) => {
		let status = false;

		for (let i = 0; i < excludeByDOMNode.length; i++) {
			if (excludeByDOMNode[i] && excludeByDOMNode[i].contains(eventTarget)) {
				status = true;
				break;
			}
		}

		for (let i = 0; i < excludeByQuerySelector.length; i++) {
			let el = document.querySelector(excludeByQuerySelector[i]);
			if (el && el.contains(eventTarget)) {
				status = true;
				break;
			}
		}

		return status;
	};

	const handleClick = (event) => {
		if (
			(includeSelf ? true : !wrapper.contains(event.target)) &&
			!isClickedOnExcluded(event.target)
		) {
			dispatch('outclick', { wrapper });
		}
	};

	const handleKeydown = (event) => {
		if (
			// With `on:click`, the A11Y `keydown` event doesn't trigger on `document.body`, so we are just duplicating the same behavior here.
			event.target !== document.body &&
			// With `on:click`, the A11Y `keydown`, only these keys trigger the event
			['Enter', 'NumpadEnter', 'Space'].includes(event.code)
		) {
			handleClick(event);
		}
	};
</script>

<!-- We have this to capture the window on pointerdown and keydown event. -->
<svelte:window on:pointerdown={handleClick} on:keydown={handleKeydown} />

<div
	bind:this={wrapper}
	class="outclick {className}"
	style={!className && !useWrapper ? 'display: contents' : ''}
>
	<slot />
</div>
