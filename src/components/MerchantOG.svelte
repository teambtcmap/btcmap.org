<script lang="ts">
	export let lat: string;
	export let lon: string;
	export let STADIA_API_KEY: string;
</script>

<img
	src="https://tiles.stadiamaps.com/static_cacheable/osm_bright.png?size=600x315@2x&markers={lat},{lon},custom:https://btcmap.org/icons/og-marker.png,,,,-16,-43&api_key={STADIA_API_KEY}"
	alt="merchant location"
	width="1200"
	height="630"
/>
