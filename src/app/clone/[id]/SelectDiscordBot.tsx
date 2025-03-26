'use client';

import {usePromise} from "@/app/forwarder/hooks";
import {getBots} from "@/app/forwarder/action";
import {Button, Skeleton} from "@mantine/core";
import Link from "next/link";

function SelectDiscordBot(props: {
	title?: string,
	description?: string
}) {
	const {result: bots, loading} = usePromise(()=>getBots());

	return (
		<div>
			<h2 className={'text-2xl text-white'}>{props.title}</h2>
			<p>{props.description}</p>
			<br/>
			<Skeleton visible={loading} className={'flex flex-col gap-2'}>
				{bots?.filter(o=>o.type !== 'TELEGRAM').map(bot => {
					return (
						<div className="flex border p-3 rounded-lg items-center gap-2">
							<div>
								<p className={'text-white font-bold'}>{bot.name}</p>
								<p className={'text-sm'}>{bot.key}</p>
							</div>
							<div>
								<Button onClick={()=>{
									window.location.pathname += `/${bot.id}`;
								}}>
									Select
								</Button>
							</div>
						</div>
					)
				})}
			</Skeleton>
		</div>
	);
}

export default SelectDiscordBot;
