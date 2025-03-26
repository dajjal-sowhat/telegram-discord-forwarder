import {getForwards} from "./page";

export type Forwards = NonNullable<Awaited<ReturnType<typeof getForwards>>>;

export function isSource(forward: any): forward is Forwards[number] {
	return !!forward.source;
}

const SPECIAL_CHARS = [
	'\\',
	'_',
	'*',
	'[',
	']',
	'(',
	')',
	'~',
	'>',
	'<',
	'&',
	'#',
	'+',
	'-',
	'=',
	'|',
	'{',
	'}',
	'.',
	'!',
	"`"
]

export const escapeMarkdown = (text: string) => {
	SPECIAL_CHARS.forEach(char => (text = text.replaceAll(char, `\\${char}`)))
	return text
}
