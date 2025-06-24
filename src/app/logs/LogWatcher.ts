
declare global {
    var LOG_EVENTS: Record<string, onLogType>
    var CACHE_LOGS: Parameters<onLogType>[]
}
global.LOG_EVENTS ||= {};
global.CACHE_LOGS ||= [];

const types = ["log", 'warn', "error"] as const;
const MAX_CACHE = 30;
const err = console.error;

export function InitLogWatcher() {

    for (const key of types) {
        const origin = console[key];
        console[key] = (...args: any[]) => {
            origin(...args);
            try {
                const log = args.map(o=>o?.toString?.()).join(" ");
                onLog(key,`${new Date().toLocaleTimeString()} ${log}`)
            } catch (e) {
                err(e)
            }
        }
    }
}

type onLogType = (type: typeof types[number], log: string) => void;

export function watchLog(key: string, func: onLogType) {
    LOG_EVENTS[key] = func;
}


function onLog(...args: Parameters<onLogType>) {
    CACHE_LOGS.push(args);
    for (const [key,event] of Object.entries(LOG_EVENTS)) {
        try {
            event(...args);
        } catch (e) {
            err(key,e)
        }
    }
    CACHE_LOGS = CACHE_LOGS.slice(-MAX_CACHE);
}