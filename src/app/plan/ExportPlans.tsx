'use client';


import {Button, Select} from "@mantine/core";
import {modals} from "@mantine/modals";
import {usePromise} from "@/app/forwarder/hooks";
import {getBots} from "@/app/forwarder/action";
import {getBotGuilds} from "@/app/clone/[id]/action";
import {useState} from "react";
import {getBotChannels} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/action";
import {handlePlanExport} from "@/app/plan/action";
import {ChannelType} from "discord.js";

function ExportPlans(props: any) {
	return (
		<Button color={'green'} onClick={()=>{
			modals.open({
				title: "EXPORT PLANS",
				children: <ExportComponent />
			})
		}}>
			Export Plans
		</Button>
	);
}


function ExportComponent() {
	const [bot, setBot] = useState<string>();
	const [guild, setGuild] = useState<string>();
	const {result: bots} = usePromise(()=>getBots());
	const {result: guilds} = usePromise(()=>getBotGuilds(bot!), bot || false);
	const {result: channels} = usePromise(()=>getBotChannels(bot!, guild!), (bot && guild) ? bot+guild:false);
	const [loading, setLoading] = useState(false);

	return (
		<form className={'flex flex-col gap-3'} action={async(d)=>{
			const data = Object.fromEntries(d.entries());
			setLoading(true);
			handlePlanExport(data as any)
				.catch(()=>alert("ERROR"))
				.then(()=>alert("OK"))
				.finally(()=>setLoading(false));
		}}>
			<Select
				onChange={setBot as any}
				label={'Select Bot'}
				name={'bot'}
				data={bots?.filter(o => o.type === 'DISCORD')
					.map(o => ({label: o.name, value: o.id}))}
			/>

			<Select
				label={'Select Server'}
				name={'guild'}
				onChange={setGuild as any}
				data={guilds?.map(o => ({label: o.name, value: o.id}))}
			/>
			<Select
				description={'All Plans will export to this channel'}
				label={'Select Channel'}
				name={'channel'}
				data={channels?.filter(o=>o.type === 0).map(o => ({label: o.name, value: o.id}))}
			/>
			<Button type={'submit'}>
				Export
			</Button>
		</form>
	)
}

export default ExportPlans;
