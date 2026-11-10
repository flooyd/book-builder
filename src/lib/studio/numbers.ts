// Numbers typed into the studio's fields. A field takes sums as well as numbers ("120+24",
// "300/2", "(40+8)*3"), and a sum that starts with *, / or + works on the value already there
// ("*2" doubles it). No eval: a small parser that knows numbers, + - * / and brackets.

/** The value of what was typed, or null if it isn't a number or a sum. */
export function calculate(input: string, current: number): number | null {
	let text = input
		.trim()
		.replace(/,/g, '.')
		.replace(/\s+/g, '')
		.replace(/(px|°|%|deg)$/i, '')
		.replace(/×/g, '*')
		.replace(/÷/g, '/');
	if (!text) return null;
	if (/^[*/+]/.test(text)) text = `${current}${text}`;

	let index = 0;
	const peek = () => text[index];

	function sum(): number {
		let value = product();
		while (peek() === '+' || peek() === '-') {
			const operator = text[index++];
			const right = product();
			value = operator === '+' ? value + right : value - right;
		}
		return value;
	}

	function product(): number {
		let value = factor();
		while (peek() === '*' || peek() === '/' || peek() === 'x') {
			const operator = text[index++];
			const right = factor();
			value = operator === '/' ? value / right : value * right;
		}
		return value;
	}

	function factor(): number {
		if (peek() === '-') {
			index++;
			return -factor();
		}
		if (peek() === '+') {
			index++;
			return factor();
		}
		if (peek() === '(') {
			index++;
			const value = sum();
			if (peek() !== ')') throw new Error('Unclosed bracket');
			index++;
			return value;
		}
		const match = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(text.slice(index));
		if (!match) throw new Error('Not a number');
		index += match[0].length;
		return Number(match[0]);
	}

	try {
		const value = sum();
		return index === text.length && Number.isFinite(value) ? value : null;
	} catch {
		return null;
	}
}

/** A value for a field: rounded to some places, with no trailing zeros. */
export function formatNumber(value: number, places = 2) {
	const factor = 10 ** places;
	const rounded = Math.round(value * factor) / factor;
	return String(Object.is(rounded, -0) ? 0 : rounded);
}
