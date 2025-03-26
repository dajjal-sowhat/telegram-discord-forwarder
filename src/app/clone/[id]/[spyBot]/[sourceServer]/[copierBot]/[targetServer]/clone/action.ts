'use server';

import {getBot, isDiscordClient} from "@/core/bot/client";
import {serverClone} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";

export async function testClone() {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(c) {
			console.log('strart')
			setTimeout(()=>{
				c.enqueue(encoder.encode("HELLO WORLD"))
			},100)
		}
	});
}

export async function getBotGuild(id: string, guildId: string) {
	const client = await getBot(id);
	if (!isDiscordClient(client)) throw("Should be an discord client");
	return client.guilds.fetch(guildId).then(e=>({
		name: e.name,
		icon: e.iconURL({size: 64}),
		id: e.id,
	}));
}

export async function getBotChannels(id: string,guildId: string) {
	const client = await getBot(id);
	if (!isDiscordClient(client)) throw("Should be an discord client");
	const guild = await client.guilds.fetch(guildId);

	return guild.channels.cache.map(o => ({
		name: ('name' in o ? o.name:undefined) || `unnamed(${o.id})`,
		id: o.id,
		parent: o.parentId,
		type: o.type
	}))
}


type Params = Parameters<typeof serverClone>;
export async function handleClone(a1: Params[0],a2: Params[1]) {
	return new ReadableStream<string>({
		async start(controller) {
			const encoder = new TextEncoder();
			await serverClone(a1,a2, (str,n)=>{
				const o = JSON.stringify({
					log: str,
					percent: n
				})+"__BR__";
				controller.enqueue(encoder.encode(o).toString());
			});
		}
	});
}
