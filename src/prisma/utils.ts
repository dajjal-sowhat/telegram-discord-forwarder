export function ssr<T>(o:T) {
	try {
		return JSON.parse(JSON.stringify(o)) as T;
	} catch {
		return o;
	}
}
