'use client'

import {usePromise} from "@/app/forwarder/hooks";
import {getBots} from "@/app/forwarder/action";
import {getBotChannels} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/action";
import {useEffect, useState} from "react";
import {Bot} from ".prisma/client";
import {getBotGuilds} from "@/app/clone/[id]/action";
import {Select} from "@mantine/core";
import {getGuildRoles} from "@/app/plan/[id]/action";
import {PrismaModelType} from "@/prisma/PrismaClient";

function SelectGuildAndRole({plan}: {
	plan?: PrismaModelType<'plan'>
}) {

	const [selectedBot, setSelectedBot] = useState<(typeof bots)[number]['id'] | undefined>(plan?.botId);
	const [selectedGuild, setSelectedGuild] = useState<(typeof guilds)[number]['id']| undefined>(plan?.guild)
	const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]['id']| undefined>(plan?.role)
	const {result: bots,loading} = usePromise(()=>getBots());
	const {result: guilds, loading: l1} = usePromise(()=>getBotGuilds(selectedBot!), selectedBot || false);
	const {result: roles, loading: l2} = usePromise(()=>getGuildRoles(selectedBot!, selectedGuild!), (selectedBot && selectedGuild) ? selectedGuild:false);

	useEffect(() => {
		setSelectedGuild(plan?.guild);
	}, [selectedBot]);

	useEffect(() => {
		setSelectedRole(plan?.role);
	}, [selectedGuild]);

	return (
		<div>
			<Select
				label={'Select Bot'}
				searchable
				key={bots?.length}
				disabled={loading}
				required
				defaultValue={selectedBot}
				data={bots?.filter(e => e.type === 'DISCORD').map(o => ({label: o.name, value: o.id})) || []}
				onChange={setSelectedBot as any}
				description={'This bot will handle plan features (like anonc,payment...)'}
			/>
			<div className={'grid lg:grid-cols-2 gap-3 mt-2'}>
				<Select
					key={guilds?.length}
					label={'Select Server'}
					disabled={!guilds || l1}
					searchable
					defaultValue={selectedGuild}
					required
					onChange={setSelectedGuild as any}
					description={'This plan only available on this guild'}
					data={guilds?.map(o => ({label: o.name, value: o.id})) || []}
				/>
				<Select
					disabled={!selectedGuild || l2}
					label={'Select Role'}
					key={roles?.length}
					required
					defaultValue={selectedRole}
					onChange={setSelectedRole as any}
					description={'This role will give users'}
					data={roles?.map(o=>({label: o.name, value:o.id})) || []}
					searchable
				/>
			</div>
			{[
				`guild:${selectedGuild}`,
				`bot:${selectedBot}`,
				`role:${selectedRole}`,
			].filter(str=>!str.endsWith("undefined")).map(str => (
				<input key={str} name={str.split(":")[0]} hidden value={str.split(":").slice(1).join(":")} />
			))}
		</div>
	);
}

export default SelectGuildAndRole;
