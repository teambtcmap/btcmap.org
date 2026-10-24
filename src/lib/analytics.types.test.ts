import { describe, expect, it, vi } from "vitest";

import { trackEvent } from "./analytics";

vi.mock("$app/env", () => ({ dev: true }));

// Compile-time checks: `pnpm run check` / `typecheck` fail when a call marked
// as an expected error starts compiling. At runtime trackEvent is a dev no-op.
describe("trackEvent payload types", () => {
	it("binds each event to its own payload", () => {
		trackEvent("search_query");
		trackEvent("comment_add_click", { source: "map_drawer" });
		trackEvent("add_place_submit_success", { attributed: true });

		// @ts-expect-error an event without data takes none
		trackEvent("search_query", { q: "x" });
		// @ts-expect-error an event with data requires it
		trackEvent("comment_add_click");
		// @ts-expect-error a dimension outside its union
		trackEvent("comment_add_click", { source: "somewhere" });
		// @ts-expect-error a key the event doesn't carry
		trackEvent("note_open", { source: "map", extra: 1 });
		// @ts-expect-error retired events are gone from the map
		trackEvent("backup_credentials_copied");

		expect(true).toBe(true);
	});
});
