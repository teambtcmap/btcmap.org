import type { PlacePhotoSource } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import { deleteErrorKey, deletePlacePhoto } from "#lib/placePhotos.js";
import { errToast, successToast } from "#lib/utils.js";

// "Delete photo" is ask → cancel | confirm in both the viewer's ⋯ menu and
// on My photos. Each surface keeps its own confirm state; the tracking, the
// API call and the toasts live here so the two can't drift apart.

export const askPhotoDelete = (source: PlacePhotoSource) =>
	trackEvent("place_photo_delete_click", { source });

export const cancelPhotoDelete = (source: PlacePhotoSource) =>
	trackEvent("place_photo_delete_cancel", { source });

type ConfirmPhotoDeleteArgs = {
	placeId: number;
	imageId: number;
	token: string;
	source: PlacePhotoSource;
	// The caller's $_, so this module stays free of the i18n store
	t: (key: string) => string;
};

// true once the photo is gone; a failure is already reported to the user
export const confirmPhotoDelete = async ({
	placeId,
	imageId,
	token,
	source,
	t,
}: ConfirmPhotoDeleteArgs): Promise<boolean> => {
	try {
		await deletePlacePhoto(placeId, imageId, token);
		trackEvent("place_photo_delete_success", { source });
		successToast(t("placePhotos.deleted"));
		return true;
	} catch (error) {
		console.error("place photos: delete failed", error);
		errToast(t(deleteErrorKey(error)));
		return false;
	}
};
