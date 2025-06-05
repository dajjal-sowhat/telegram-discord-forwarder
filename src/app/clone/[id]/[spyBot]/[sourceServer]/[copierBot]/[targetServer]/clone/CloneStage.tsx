'use client';

import {ClonerContext} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/context";
import {useContext, useEffect, useMemo, useRef, useState} from "react";
import {Button, Code, Progress, Select} from "@mantine/core";
import {
	changeClonePause,
	changeCloneStatus,
	handleClone
} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/action";
import {
	ClonerParams
} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";
import {PrismaModelType} from "@/prisma/PrismaClient";
import {TaskStatus} from "@prisma/client";
import {useRouter} from "next/navigation";


function CloneStage(props: {
	params: typeof ClonerParams,
	filters: string[],
	task?: PrismaModelType<'cloneTask'>
}) {
	const task = props?.task
	const context = useContext(ClonerContext);
	const [verified, setVerified] = useState(props?.task?.status === "RUNNING");
	const init = useRef(false);
	const [logs, setLogs] = useState<string[]>([]);
	const [percent, setPercent] = useState(0);
	const router = useRouter();

	const handle = async () => {
		const res = await handleClone(props.task || props.params, {
			filters: props.filters as any,
			channels: context.selectedChannels[0] || []
		}).catch(()=>undefined);
		if (!res) throw("Invalid response");

		const reader = res.getReader();
		do {
			let {value: content, done} = await reader.read();

			if (!!content) {
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

			if (done) {
				router.push("./");
				break;
			}
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
				<div className={'flex flex-col gap-2 flex-grow'}>
					<p>Cloning {Math.round(percent)}%</p>
					<Progress value={percent} className={'flex-grow'}/>
				</div>
				{task && (
					<Select label={'Change Status'} defaultValue={task.status} data={[
						"Pause",
						"Resume",
						"Stop",
						"Start"
					]} onChange={async(e)=>{
						if (!e) return;

						if (e === "Start") {
							changeCloneStatus(task,"RUNNING")
								.finally(()=>{
									router.refresh();
								})
						} else if (e === "Stop") {
							changeCloneStatus(task,"STOPPED")
								.finally(()=>{
									router.refresh();
								})
						} else {
							changeClonePause(task, e === "Pause")
								.finally(()=>{
									router.refresh();
								})
						}
					}} placeholder={'Change Status'} size={'xs'} />
				)}
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
