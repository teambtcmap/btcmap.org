<script lang="ts">
	interface Props {
		lat: string;
		lon: string;
		STADIA_API_KEY: string;
	}

	let { lat, lon, STADIA_API_KEY }: Props = $props();
</script>

<img
	src="https://tiles.stadiamaps.com/static_cacheable/osm_bright.png?size=600x315@2x&markers={lat},{lon},custom:https://btcmap.org/icons/og-marker.png,,,,-32,-86&api_key={STADIA_API_KEY}"
	alt="merchant location"
	width="1200"
	height="630"
/>
