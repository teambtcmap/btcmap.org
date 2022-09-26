# BTC Map website

[![Netlify Status](https://api.netlify.com/api/v1/badges/8a9b0504-641c-4975-9e2b-daefe43f93e8/deploy-status)](https://app.netlify.com/sites/btcmap/deploys)

## PR's, issues and feature requests welcome

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
	allow="geolocation"
	src="https://btcmap.org/map"
>
</iframe>
```

You can adjust the `width` and `height` attributes to fit your page.

**NOTE:** If you want the geolocation feature to work you must also allow this in the `Permissions Policy HTTP Header` on the server of your website.

```
Permissions-Policy: geolocation=(self "https://btcmap.org")
```

For more information see this [article](https://developer.chrome.com/docs/privacy-sandbox/permissions-policy/).

### If you would like the map the initialize on a specific location there are a couple more steps to complete

1. Visit [btcmap.org/map](https://btcmap.org/map) and zoom the map to your desired location
2. Click anywhere on the map and open up the `console` in `DevTools` for your browser
3. An iframe `src` attribute URL will be generated for you like this:

```console
Here is your iframe embed URL: https://btcmap.org/map?lat=47.502358951968596&long=39.58374023437501&lat=40.63896734381725&long=24.587402343750004
Thanks for using BTC Map!
```

4. Add this URL to your `iframe` embed code

### If you would like to filter by payment method

Add the preferred payment method(s) as `URLSearchParams` to the `src` attribute of your `iframe`. These can be added in addition to the location params above.

The available options are:

- onchain
- lightning
- nfc

Example: `/map?onchain&lightning`

That's it!

---

## Basemap tile attributions

Thanks to:

- [OpenStreetMap](https://www.openstreetmap.org) (OpenStreetMap, OpenStreetMapDE, OpenStreetMapFR)
- [OpenTopoMap](https://opentopomap.org) (Topo)
- [ESRI](https://www.esri.com) (Imagery)
- [Stamen](http://maps.stamen.com) (Terrain, Toner, Toner Lite, Watercolor)
