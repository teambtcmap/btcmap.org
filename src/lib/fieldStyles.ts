// The border and focus outline a form control wears (#1404, #1406): the
// error colour while it's invalid — focused too, or the link-coloured
// focus ring would paint over the error border — the input colour
// otherwise.
export const fieldBorderClasses = (invalid: boolean): string =>
	invalid
		? "border-error focus:outline-error"
		: "border-input focus:outline-link";
