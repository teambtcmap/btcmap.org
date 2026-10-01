// Keep ?issues csv commas literal in written URLs: URL serialization
// %2C-encodes them, and worklist links (#921) are meant to be pasted into
// chats as-is. Commas are valid query characters, so this is
// parse-equivalent. Shared by every site that writes the query string.
// Dependency-free on purpose, so plain $lib modules and their unit tests can
// use it ($lib/merchantDrawerHash pulls in $app/environment).
export const withLiteralCommas = (url: string): string =>
	url.replace(/%2C/g, ",");
