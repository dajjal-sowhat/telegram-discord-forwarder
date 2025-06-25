export function ssr<T>(o: T) {
    try {
        return JSON.parse(JSON.stringify(o)) as T;
    } catch {
        return o;
    }
}

export async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms)).catch(console.error);
}

export function singleFlightFunc<T extends (this: any, ...args: any[]) => Promise<any>>(asyncFunction: T, wait = 0, name = asyncFunction.name): T {
    let currentExecution = Promise.resolve();
    let n = 0;
    return function (this: any, ...args: Parameters<T>) {
        n++;
        const handle = async () => {
            n--;
            if (n > 20) console.warn(`[SingleFlightFunc:${name || "UnknownFunction"}] Too many concurrent executions ${n}, this may cause performance issues.`);
            if (wait) await sleep(wait);
            return asyncFunction.apply(this, args);
        }
        currentExecution = currentExecution
            .then(handle)
            .catch(handle)
        return currentExecution;
    } as T;
}

export function timeoutFunc<T>(
    promiseFactory: () => Promise<T>,
    timeoutMs = 10000,
    msg = `${promiseFactory.name || "UnknownFunc"} TIMEOUT`
): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
            reject(`[timeoutFunc:${(timeoutMs/1000).toFixed(2)}s] ${msg}`)
        }, timeoutMs);
        const promise = promiseFactory();

        promise
            .then(resolve)
            .catch(reject)
            .finally(() => {
                clearTimeout(t);
            })
    })
}

export function Throw(...args: any[]): never {
    console.error(...args);
    throw new Error(...args);
}