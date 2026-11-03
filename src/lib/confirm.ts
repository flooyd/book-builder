// Typing a title before something is deleted for good. The check is about meaning it, not about
// spelling: capitals, accents, curly quotes, dashes and spacing don't have to match, since a phone
// types ’ where a keyboard types ' and not every keyboard has an é.

/** A title reduced to what anyone can be expected to type. */
const typeable = (text: string) =>
	text
		// Compatibility forms too: … becomes ... and a non-breaking space a space.
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[‘’‚‛′`´]/g, "'")
		.replace(/[“”„‟″«»]/g, '"')
		.replace(/[‐‑‒–—―−]/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.toLocaleLowerCase();

/** What has to be typed: the title, or "delete" when it has none. */
export const confirmWord = (title: string) => (typeable(title) ? title.trim() : 'delete');

/** Whether what's been typed is the title, give or take capitals, accents, quotes and spaces. */
export const typedTitle = (typed: string, title: string) =>
	typeable(typed) === typeable(confirmWord(title));
