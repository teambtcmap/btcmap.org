import type { AxiosResponse } from "axios";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackEvent } from "$lib/analytics";
import { deletePlacePhoto } from "$lib/placePhotos";
import { errToast, successToast } from "$lib/utils";

import {
	askPhotoDelete,
	cancelPhotoDelete,
	confirmPhotoDelete,
} from "./placePhotoDelete";

vi.mock("$lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("$lib/utils", () => ({ errToast: vi.fn(), successToast: vi.fn() }));
vi.mock("$lib/placePhotos", async (importOriginal) => ({
	...(await importOriginal<typeof import("$lib/placePhotos")>()),
	deletePlacePhoto: vi.fn(),
}));

const t = (key: string) => `t:${key}`;
const args = {
	placeId: 20423,
	imageId: 12,
	token: "tok",
	source: "my_photos" as const,
	t,
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("askPhotoDelete / cancelPhotoDelete", () => {
	it("track the click and the cancel with their source", () => {
		askPhotoDelete("map_drawer");
		cancelPhotoDelete("map_drawer");
		expect(trackEvent).toHaveBeenNthCalledWith(1, "place_photo_delete_click", {
			source: "map_drawer",
		});
		expect(trackEvent).toHaveBeenNthCalledWith(2, "place_photo_delete_cancel", {
			source: "map_drawer",
		});
	});
});

describe("confirmPhotoDelete", () => {
	it("deletes, tracks success and toasts", async () => {
		vi.mocked(deletePlacePhoto).mockResolvedValue(undefined);

		expect(await confirmPhotoDelete(args)).toBe(true);
		expect(deletePlacePhoto).toHaveBeenCalledWith(20423, 12, "tok");
		expect(trackEvent).toHaveBeenCalledWith("place_photo_delete_success", {
			source: "my_photos",
		});
		expect(successToast).toHaveBeenCalledWith("t:placePhotos.deleted");
		expect(errToast).not.toHaveBeenCalled();
	});

	it("reports a 403 with its own message and no success event", async () => {
		vi.mocked(deletePlacePhoto).mockRejectedValue(
			new AxiosError("forbidden", "ERR_BAD_REQUEST", undefined, undefined, {
				status: 403,
			} as AxiosResponse),
		);

		expect(await confirmPhotoDelete(args)).toBe(false);
		expect(errToast).toHaveBeenCalledWith("t:placePhotos.deleteForbidden");
		expect(trackEvent).not.toHaveBeenCalled();
		expect(successToast).not.toHaveBeenCalled();
	});

	it("reports any other failure as a retryable error", async () => {
		vi.mocked(deletePlacePhoto).mockRejectedValue(new Error("offline"));

		expect(await confirmPhotoDelete(args)).toBe(false);
		expect(errToast).toHaveBeenCalledWith("t:placePhotos.deleteFailed");
	});
});
