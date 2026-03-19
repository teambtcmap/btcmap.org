import OpeningHours from "opening_hours";

export type OpenStatus = {
	isOpen: boolean;
	nextChange: string | null;
};

export function getOpenStatus(
	hoursString: string | undefined,
): OpenStatus | null {
	if (!hoursString) return null;

	try {
		const oh = new OpeningHours(hoursString);
		const isOpen = oh.getState();
		const nextChange = oh.getNextChange();

		let nextChangeText: string | null = null;
		if (nextChange) {
			const hours = nextChange.getHours();
			const minutes = nextChange.getMinutes();
			const ampm = hours >= 12 ? "PM" : "AM";
			const displayHours = hours % 12 || 12;
			const minutePart = minutes
				? `:${minutes.toString().padStart(2, "0")}`
				: "";
			nextChangeText = isOpen
				? `Closes ${displayHours}${minutePart} ${ampm}`
				: `Opens ${displayHours}${minutePart} ${ampm}`;
		}

		return { isOpen, nextChange: nextChangeText };
	} catch {
		return null;
	}
}
