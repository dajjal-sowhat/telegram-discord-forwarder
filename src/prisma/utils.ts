export function ssr<T>(o:T) {
	try {
		return JSON.parse(JSON.stringify(o)) as T;
	} catch {
		return o;
	}
}
export async function sleep(ms: number) {
	return new Promise(r=>setTimeout(r, ms)).catch(console.error);
}
export function singleFlightFunc<T extends (this: any, ...args: any[])=>Promise<any>>(asyncFunction: T, wait = 0): T {
	let currentExecution = Promise.resolve();
	let n = 0;
	return function(this: any, ...args: Parameters<T>) {
		n++;
		currentExecution = currentExecution.then(async () => {
			n--;
			if (wait) await sleep(wait)
			return asyncFunction.apply(this, args);
		}).catch(async ()=>{
			n--;
			if (wait) await sleep(wait)
			return asyncFunction.apply(this, args);
		})
		return currentExecution;
	} as T;
}