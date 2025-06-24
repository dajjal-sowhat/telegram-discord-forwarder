"use client";

import React, { useEffect, useRef, useState } from 'react';
import {getCacheServerLogs, getServerLogs} from "@/app/logs/action";
import Loading from "@/app/loading";

function Page(props: any) {
    const [logs, setLogs] = useState<{type: string, log: string}[]>([]);
    const init = useRef(false);

    async function connect(_try = 0) {
        console.log("Connecting to logs... ");
        const stream = await getServerLogs();
        const reader = stream.getReader();

        try {
            do {
                const { done, value } = await reader.read();
                if (done) break;

                const data = value+"";
                for (const o of data.split("__BR__")) {
                    if (!o) continue;
                    try {
                        const {type,log} = JSON.parse(o);
                        setLogs(prev => [
                            {type, log},
                            ...prev
                        ]);
                    } catch {}
                }
            } while (true)
            return connect(0);
        } catch (e) {
            if (_try > 5) throw(e);
            console.error(e);
            return connect(_try + 1);
        }
    }

    useEffect(() => {
        if (init.current) return;
        init.current = true;
        getCacheServerLogs().then(e=>{
            setLogs(e.reverse().map(([type, log]) => ({
                type,
                log
            })))
        })
        connect().catch(console.error);
    }, []);

    return (
        <div className={`flex flex-col ${!!logs.length && "bg-black"}`} style={{
            fontFamily:"consolas",
            fontWeight: "bold",
            fontSize: "20px"
        }}>
            {!logs.length && (
                <Loading />
            )}
            {logs.map(({log,type}, index) => (
                <p key={index} className={`${type === "error" ? "text-red-400 bg-red-400/5":type === "warn" ? "text-yellow-400 bg-yellow-400/5":""} p-3`}>
                    <span
                        className={type === "log" ? "text-blue-400": type === "error" ? "text-red-400": "text-yellow-400"}
                    >{logs.length - index} [{type}]{" "}</span>
                    {log}
                </p>
            ))}
        </div>
    );
}

export default Page;