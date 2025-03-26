'use client';

import Discord from "discord.js";
import {usePromise} from "@/app/forwarder/hooks";
import {getBotGuilds} from "@/app/clone/[id]/action";
import {Button, Skeleton} from "@mantine/core";

function SelectDiscordGuild(props: {
	title?: string,
	botKey: Discord.Client['bot']['key']
}) {
	const {result: guilds, loading} = usePromise(()=>getBotGuilds(props.botKey))

	return (
		<div>
			<h1 className={'text-3xl text-white'}>{props.title}</h1>
			<br/>
			<Skeleton visible={loading} className={'flex flex-col gap-5'}>
				{guilds?.map(o => {

					return (
						<div className={'border rounded-lg p-2 flex items-center gap-3'}>
							<img src={o.avatar || "/watermark.png"} alt={o.name} className={'rounded-full w-20 object-contain'} />
							<div>
								<p className={'text-white text-xl'}>{o.name}</p>
								<p className={''}>{o.members.toLocaleString()} Members</p>
							</div>
							<Button onClick={()=>{
								window.location.pathname += `/${o.id}`
							}}>
								Select
							</Button>
						</div>
					)
				})}
			</Skeleton>
		</div>
	);
}

export default SelectDiscordGuild;
