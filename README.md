# BTC Map website

[![Netlify Status](https://api.netlify.com/api/v1/badges/8a9b0504-641c-4975-9e2b-daefe43f93e8/deploy-status)](https://app.netlify.com/sites/btcmap/deploys)

## PR's, issues and feature requests welcome

## Tech stack

- sveltekit
- tailwindcss
- leafletjs
- openstreetmap
- localforage
- chartjs
- d3-geo
- marked
- dompurify
- yarn
- prettier
- axios
- vite
- fontawesome
- lottie
- opencage

(see [`package.json`](https://github.com/teambtcmap/btcmap.org/blob/main/package.json) for full list)

## Getting started

1. `git clone` the repo and `cd` into the directory
2. run `yarn` to install the packages
3. `yarn dev` will open the app on `localhost:5173`

## PWA

This website is a progressive web app, meaning you can install it on your mobile device and use it like a native application. Just look for the **Add to home screen** or **Install** option in your browser while visiting [btcmap.org](https://btcmap.org).

## Embedding

If you would like to embed the web map on your own website, simply add the following code to your HTML:

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

#### Community area

1. Add `?community=einundzwanzig-deutschland` to your `iframe` URL (replace `einundzwanzig-deutschland` with the ID of your community - this can be found in the URL when visiting your community page)

#### General area

1. Visit [btcmap.org/map](https://btcmap.org/map) and zoom the map to your desired location
2. Copy the URL from your browser tab which contains geolocation data
3. Add this URL to your `iframe` `src` attribute embed code

#### Communities only

1. Add `?communitiesOnly` to your `iframe` URL

##### Language filter

1. Add `?communitiesOnly&language=es`

##### Organization filter

1. Add `?communitiesOnly&organization=einundzwanzig`

### If you would like to filter by payment method

Add the preferred payment method(s) as `URLSearchParams` to the `src` attribute of your `iframe`. These can be added in addition to the location params above.

The available options are:

- onchain
- lightning
- nfc

Example: `/map?onchain&lightning`

That's it!

Embedding is also possible on native mobile applications by utilizing the **WebView**.

---

## Attributions

Thanks to:

### Base map tiles

- [OpenStreetMap](https://www.openstreetmap.org) (OpenStreetMap, OpenStreetMapDE, OpenStreetMapFR)
- [OpenTopoMap](https://opentopomap.org) (Topo)
- [ESRI](https://www.esri.com) (Imagery)
- [Stamen](http://maps.stamen.com) (Terrain, Toner, Toner Lite, Watercolor)
- [Stadia](https://stadiamaps.com/) (Alidade Smooth, Alidade Smooth Dark, Outdoors, OSM Bright)

### Icons

Tagger profile badges by [AndrejCibik](https://twitter.com/AndrejCibik)

<a href="https://www.flaticon.com/free-icons/satoshi-nakamoto" title="satoshi nakamoto icons">Satoshi nakamoto icons created by Vitaly Gorbachev - Flaticon</a>

Treasure Chest icon by [Bonsaiheldin](https://opengameart.org/content/treasure-chests-32x32)

---

![Untitled](https://user-images.githubusercontent.com/85003930/194117128-2f96bafd-2379-407a-a584-6c03396a42cc.png)
