// Externally-sourced values are untrusted, so a field destined for a
// resource URL (a Nostr kind:0 picture into <img src>, an area's
// icon:square into a favicon <link href>) must be a real http(s) URL.
// Reject javascript:, data:, and anything unparseable rather than handing
// it to the DOM. Deliberately dependency-free so any chunk can import it
// without dragging feature code along.
export function safeHttpUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const { protocol } = new URL(value);
		return protocol === "http:" || protocol === "https:" ? value : null;
	} catch {
		return null;
	}
}
