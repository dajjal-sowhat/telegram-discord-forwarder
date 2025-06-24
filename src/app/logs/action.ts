'use server';

import {watchLog} from "@/app/logs/LogWatcher";

export async function getServerLogs() {
    const name = getServerLogs.name;
    return new ReadableStream({
        start(controller) {
            watchLog(name, (type,log) => {
                controller.enqueue(JSON.stringify({
                    type,
                    log
                })+"__BR__")
            })
        },
        cancel() {
            delete global.LOG_EVENTS[name];
        }
    })
}

export async function getCacheServerLogs() {
    return CACHE_LOGS;
}