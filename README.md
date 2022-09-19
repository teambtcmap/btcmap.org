# BTC Map website

## Tech stack

- sveltekit
- tailwindcss
- yarn
- prettier
- fontawesome
- leafletjs
- openstreetmap
- axios
- vite
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

`<iframe id="btcmap"
    title="BTC Map"
    width="600"
    height="300"
		allowfullscreen="true"
    src="https://btcmap.org/map">

</iframe>`

You can adjust the `width` and `height` attributes to fit your page.
