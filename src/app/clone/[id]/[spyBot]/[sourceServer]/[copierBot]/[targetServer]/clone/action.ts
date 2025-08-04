'use server';

import { getBot, isDiscordClient } from "@/core/bot/client";
import {
	getCloneHandler,
	serverClone
} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";
import { CloneTask, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { Select } from "@mantine/core";
import { PrismaModelType } from "@/prisma/PrismaClient";

export async function testClone() {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(c) {
			console.log('strart')
			setTimeout(() => {
				c.enqueue(encoder.encode("HELLO WORLD"))
			}, 100)
		}
	});
}

export async function getBotGuild(id: string, guildId: string) {
	const client = await getBot(id);
	if (!isDiscordClient(client)) throw ("Should be an discord client");
	return client.guilds.fetch(guildId).then(e => ({
		name: e.name,
		icon: e.iconURL({ size: 64 }),
		id: e.id,
	}));
}

export async function changeCloneStatus(id: string | PrismaModelType<'cloneTask'>, status: PrismaModelType<'cloneTask'>['status']) {
	const clone = typeof id === 'string' ? global.tasks[id] : getCloneHandler(id);
	if (!clone) return;

	clone.status = status;
}

export async function changeClonePause(id: string | PrismaModelType<'cloneTask'>, status: boolean) {
	const clone = typeof id === 'string' ? global.tasks[id] : getCloneHandler(id);
	if (!clone) return;

	console.log(clone, status);
	clone.pause = status;
}

export async function getBotChannels(id: string, guildId: string) {
	const client = await getBot(id);
	if (!isDiscordClient(client)) throw ("Should be an discord client");
	const guild = await client.guilds.fetch(guildId);

	return guild.channels.cache.map(o => ({
		name: ('name' in o ? o.name : undefined) || `unnamed(${o.id})`,
		id: o.id,
		parent: o.parentId,
		type: o.type
	}))
}


type Params = Parameters<typeof serverClone>;
export async function handleClone(a1: Params[0], a2: Params[1]) {
	const id = crypto.randomUUID();
	const task = await serverClone(a1, a2);
	return new ReadableStream<string>({
		async start(controller) {
			task.logFunction[id] = (str, n) => {
				const o = JSON.stringify({
					log: str,
					percent: n
				}) + "__BR__";
				controller.enqueue(o);
				if (n === 100 && str.includes("FINISHED")) controller.close();
			}
		},
		cancel() {
			delete task.logFunction[id];
		}
	});
}
