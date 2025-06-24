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

export function timeoutFunc<T>(
	promiseFactory: () => Promise<T>,
	timeoutMs = 10000
): Promise<T> {
	const timeoutPromise = new Promise<T>((_, reject) => {
		const id = setTimeout(() => {
			console.error("PROMISE TIMEOUT!");
			clearTimeout(id); // Clear the timeout to prevent it from lingering
			reject(new Error(`TimeoutError: Promise exceeded ${timeoutMs}ms limit.`));
		}, timeoutMs);
	});

	return Promise.race([
		promiseFactory(), // The user's original promise
		timeoutPromise    // The timeout mechanism
	]);
}

export function Throw(message: string): never {
	throw new Error(message);
}