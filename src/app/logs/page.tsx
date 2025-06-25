"use client";

import React, { useEffect, useRef, useState } from 'react';
import { getCacheServerLogs, getServerLogs } from "@/app/logs/action";
import Loading from "@/app/loading";

function Page(props: any) {
    const [logs, setLogs] = useState<{ type: string, log: string }[]>([]);
    const init = useRef(false);

    async function connect(_try = 0) {
        console.log("Connecting to logs... ");
        const stream = await getServerLogs();
        const reader = stream.getReader();

        try {
            do {
                const { done, value } = await reader.read();
                if (done) break;

                const data = value + "";
                for (const o of data.split("__BR__")) {
                    if (!o) continue;
                    try {
                        const { type, log } = JSON.parse(o);
                        setLogs(prev => [
                            { type, log },
                            ...prev
                        ]);
                    } catch { }
                }
            } while (true)
            return connect(0);
        } catch (e) {
            if (_try > 5) throw (e);
            console.error(e);
            return connect(_try + 1);
        }
    }

    useEffect(() => {
        if (init.current) return;
        init.current = true;
        getCacheServerLogs().then(e => {
            setLogs(e.reverse().map(([type, log]) => ({
                type,
                log
            })))
        })
        connect().catch(console.error);
    }, []);

    return (
        <div className={`flex flex-col ${!!logs.length && "bg-black"}`} style={{
            fontFamily: "consolas",
            fontWeight: "bold",
            fontSize: "20px"
        }}>
            {!logs.length && (
                <Loading />
            )}
            {logs.map(({ log, type }, index) => {
                if (
                    log.includes("done") ||
                    log.includes("successfully") ||
                    log.includes("success") ||
                    log.includes("completed")
                ) {
                    type = "success";
                }

                const color =
                    type === "success" ? "text-green-400" :
                        type === "warn" ? "text-yellow-400" :
                            type === "error" ? "text-red-400" :
                                "";

                const bg_color =
                    type === "error" ? "bg-red-400/5" :
                        type === "warn" ? "bg-yellow-400/5" :
                            type === "success" ? "bg-green-400/5" :
                                ""
                const [firstLine, ...other] = log.split("\n");
                return (
                    <div key={index} className={`${bg_color} ${color} p-3`}>
                        <div className='flex items-center flex-wrap gap-2 justify-start'>
                            <span
                                className={`${color || "text-blue-400"} text-nowrap`}
                            >{logs.length - index} [{type}]{" "}</span>
                            <p>{firstLine}</p>
                        </div>
                        {other.map((line, i) => (
                            <p key={i} className="whitespace-pre-wrap">
                                {line}
                            </p>
                        ))}
                    </div>
                )
            })}
        </div>
    );
}

export default Page;