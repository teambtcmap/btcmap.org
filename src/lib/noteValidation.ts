// Rules for the note card's text (#1542), matching btcmap-api's own checks
// (src/rest/v4/notes.rs): trimmed, not empty, at most 2000 characters.

export const NOTE_TEXT_MAX_LENGTH = 2000;

export type NoteInput = { text: string };
export type NoteErrors = { text?: "required" | "tooLong" };

export const NOTE_FIELD_ORDER = ["text"] as const;

export const validateNote = (input: NoteInput): NoteErrors => {
	const text = input.text.trim();
	if (!text) return { text: "required" };
	// Characters, not UTF-16 units, as the API counts them
	if ([...text].length > NOTE_TEXT_MAX_LENGTH) return { text: "tooLong" };
	return {};
};
