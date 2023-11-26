<script lang="ts">
	export let date;
	export let style = '';

	import { onDestroy } from 'svelte';

	// Set the date we're counting down to
	const countDownDate = new Date(date).getTime();

	let days = '- -';
	let hours = '- -';
	let minutes = '- -';
	let seconds = '- -';
	let distance = 0;

	// Update the count down every 1 second
	const timer = setInterval(function () {
		// Get today's date and time
		const now = new Date().getTime();

		// Find the distance between now and the count down date
		distance = countDownDate - now;

		// Time calculations for days, hours, minutes and seconds
		days = Math.floor(distance / (1000 * 60 * 60 * 24));
		hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
		seconds = Math.floor((distance % (1000 * 60)) / 1000);

		// If the count down is finished, clear the interval
		if (distance < 0) {
			clearInterval(timer);
		}
	}, 1000);

	onDestroy(() => {
		clearInterval(timer);
	});
</script>

{#if distance < 0}
	<div class={style}>0d 0h 0m 0s</div>
{:else}
	<div class={style}>{days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's '}</div>
{/if}
