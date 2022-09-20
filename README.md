# BTC Map website

[![Netlify Status](https://api.netlify.com/api/v1/badges/8a9b0504-641c-4975-9e2b-daefe43f93e8/deploy-status)](https://app.netlify.com/sites/btcmap/deploys)

## Tech stack

- sveltekit
- tailwindcss
- leafletjs
- openstreetmap
- yarn
- prettier
- axios
- vite
- fontawesome
- lottie

## Getting started

1. `git clone` the repo and `cd` into the directory
2. run `yarn` to install the packages
3. `yarn dev` will open the app on `localhost:5173`
4. please run `yarn format` after making any changes and before submitting a PR

## PWA

This website is a progressive web app, meaning you can install it on your mobile device and use it like a native application. Just look for the **Add to home screen** option in your browser while visiting [btcmap.org](https://btcmap.org).

## Embedding

If you would like to embed the map on your own website, simply add the following code to your HTML:

```html
<iframe
	id="btcmap"
	title="BTC Map"
	width="600"
	height="300"
	allowfullscreen="true"
	src="https://btcmap.org/map"
>
</iframe>
```

You can adjust the `width` and `height` attributes to fit your page.

If you would like the map the initialize on a specific location there are a couple more steps to complete.

1. Visit [btcmap.org/map](https://btcmap.org/map) and zoom the map to your desired location
2. Click anywhere on the map and open up the `console` in `DevTools` for your browser
3. Open the `R` object, it will look like this:
   ![Example object](/static/images/object-example.png 'Example object')
4. Add `URLSearchParams` to the `src` attribute of your `iframe` populating the `lat=` and `long=` fields with the data from the `R` object as follows:

   `?lat=53.173119202640635&long=5.844726562500001&lat=47.04766864046083&long=-9.151611328125002`

5. Your complete source attribute for your iframe embed will look like this:

   [https://btcmap.org/map?lat=`53.173119202640635`&long=`5.844726562500001`&lat=`47.04766864046083`&long=`-9.151611328125002`](https://btcmap.org/map?lat=53.173119202640635&long=5.844726562500001&lat=47.04766864046083&long=-9.151611328125002)

That's it! Make sure you copy the values in the same order as they are in the `object`.
