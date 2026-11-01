declare module 'hyphen/en-gb' {
	const hyphen: {
		/** The text with a soft hyphen, unless told otherwise, at each place a word may break. */
		hyphenateSync(text: string, options?: { hyphenChar?: string }): string;
	};
	export default hyphen;
}
