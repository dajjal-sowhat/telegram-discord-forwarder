'use client';

import {ClonerContext} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/context";
import {useContext, useEffect, useMemo, useRef, useState} from "react";
import {Button, Code, Progress} from "@mantine/core";
import {handleClone} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/action";
import {ClonerParams} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";
import {PrismaModelType} from "@/prisma/PrismaClient";

function CloneStage(props: {
	params: typeof ClonerParams,
	filters: string[],
	task?: PrismaModelType<'cloneTask'>
}) {
	const context = useContext(ClonerContext);
	const [verified, setVerified] = useState(props?.task?.status === "RUNNING");
	const init = useRef(false);
	const [logs, setLogs] = useState<string[]>([]);
	const [percent, setPercent] = useState(0);

	const handle = async () => {
		const res = await handleClone(props.task || props.params, {
			filters: props.filters as any,
			channels: context.selectedChannels[0] || []
		}).catch(()=>undefined);
		if (!res) throw("Invalid response");

		const decoder = new TextDecoder();
		const reader = res.getReader();
		do {
			const {value, done} = await reader.read();

			if (!!value) {
				const content = decoder.decode(value as any);
				for (let string of content.split("__BR__")) {
					if (!string.trim()) continue;
					try {
						const json = JSON.parse(string) as { log: string, percent: number };

						setLogs(pre => [ json.log,...pre]);
						setPercent(json.percent);
					} catch (e) {
						console.error(e);
					}
				}
			}

			if (done) break;
		} while (true);
	}

	useEffect(() => {
		if (!init.current) {
			init.current = true;
			return;
		}
		if (!verified) return;

		handle().catch(console.error);
	}, [verified]);

	if (!verified) return (
		<div>
			<p>Are you sure to clone {context.selectedChannels[0]?.length || 0} channels?</p>
			<br/>
			<div className={'flex gap-2'}>
				<Button size={'xs'} onClick={() => setVerified(true)}>
					Yes
				</Button>
				<Button color={'red'} size={'xs'} onClick={() => context.cloneState[1](false)}>
					No, Back
				</Button>
			</div>
		</div>
	)

	return (
		<div>
			<div className="flex gap-2 items-center">
				<p>Cloning {Math.round(percent)}%</p>
				<Progress value={percent} className={'flex-grow'}/>
			</div>
			<hr className={'my-5'}/>
			{logs.map((log, i) => {
				const s = (s: string)=>log.toLowerCase().includes(s.toLowerCase());
				const color = s("error") || s("Unknown") || s("miss") ? "red" :
					s("done") || s('successful') ? "green" :
						s(" not ") || s("duplicate") || s("warn") ? "orange" : s("...") ? "blue":"gray"

				return (
					<div key={i}>
						<Code color={color}>{log}</Code>
					</div>
				)
			})}
		</div>
	);
}

export default CloneStage;
