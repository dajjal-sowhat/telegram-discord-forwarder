'use server';

import prisma, {PrismaModelType} from "../../prisma/PrismaClient";
import {ChannelType, TextChannel} from "discord.js";
import {Bot, ForwardChannel, Prisma} from ".prisma/client";
import {getBot, getDiscordBot, isDiscordClient} from "@/core/bot/client";
import {ssr} from "@/prisma/utils";

type PrismaClient = typeof prisma;
type PrismaModel = keyof PrismaClient;
type PrismaAction<T extends PrismaModel> = keyof PrismaClient[T];

export async function prismaQuery<T extends PrismaModel, A extends PrismaAction<T>>(
	model: T,
	action: A,
	//@ts-ignore
	params: Parameters<PrismaClient[T][A]>[0]
	//@ts-ignore
): Promise<Awaited<ReturnType<PrismaClient[T][A]>>> {
	return await (prisma[model][action] as any)(params);
}


export async function getAvailableChannels(bot: PrismaModelType<'bot'>) {
	const client = await getBot(bot);

	if (isDiscordClient(client)) {
		return client.channels.cache.map((ch) => {
			if (!(ch instanceof TextChannel)) return;
			return {
				name: ch.name + `[${ch.guild.name}]`,
				channelId: ch.id,
				type: bot.type,
				botId: bot.id,
				created_at: ch.createdAt
			}
		}).filter(o=>!!o)
	} else {
		return prisma.forwardChannel.findMany({
			where: {
				botId: bot.id
			}
		})
	}
}


export async function handleForwardRegister(sourceBot: PrismaModelType<'bot'>,destinationBot: PrismaModelType<'bot'>,sourceId: string | ForwardChannel, destinationId: string | ForwardChannel) {
	const source = typeof sourceId === 'string' ? await getForwardChannel(sourceBot,sourceId):sourceId;
	const des = typeof destinationId === 'string' ? await getForwardChannel(destinationBot,destinationId):destinationId;

	const action = await prisma.forwardAction.upsert({
		where: {
			uniq: {
				sourceId: source.channelId,
				botId: sourceBot.id
			}
		},
		create: {
			sourceId: source.channelId,
			botId: sourceBot.id
		},
		update: {}
	})

	await prisma.forwardActionDestination.upsert({
		where: {
			id: {
				destinationId: des.channelId,
				actionId: action.id
			}
		},
		create: {
			destinationId: des.channelId,
			actionId: action.id,
			botId: destinationBot.id
		},
		update: {}
	});
}

export async function getDiscordCategories(bot: PrismaModelType<'bot'>) {
	const discordBot = await getDiscordBot(bot);
	return Array.from(discordBot.channels.cache.filter(o => o.type === ChannelType.GuildCategory).values()).map(ch => ({
		name: ch.name + `[${ch.guild.name}]`,
		id: ch.id,
		exists: false,
		type: "DISCORD_CAT"
	}))
}

export async function handleCategoryForward(sourceBot: PrismaModelType<'bot'>,destinationBot: PrismaModelType<'bot'>,categoryId: string,destinationId: string) {
	const sourceClient = await getDiscordBot(sourceBot);
	const textChannels = Array.from(sourceClient.channels.cache.filter(o =>o.type === ChannelType.GuildText).values());
	const targets = textChannels.filter(t => t.parentId === categoryId);
	const destination = await getForwardChannel(destinationBot,destinationId);

	await Promise.all(targets.map(async t => {
		return await handleForwardRegister(sourceBot,destinationBot,t.id,destination)
	}));

}

export async function deleteManyForward(sources: string[]) {
	return await prisma.forwardAction.deleteMany({
		where: {
			OR: sources.map(source => ({
				source: {
					channelId: source
				}
			}))
		}
	})
}

export async function getForwardChannel(bot: PrismaModelType<'bot'>,id: string) {
	const channels = await getAvailableChannels(bot);


	let targetChannel = channels.find(o => o?.channelId === id);
	if(!targetChannel) throw(`${bot.name} channels ${id} Channel not found`);

	return await prisma.forwardChannel.upsert({
		where: {
			id: {
				channelId: targetChannel.channelId,
				botId: bot.id
			}
		},
		create: targetChannel,
		update: targetChannel
	})
}

export async function getBots() {
	return await prisma.bot.findMany().then(e=>e.map(o=>({...o,token: ""}))).then(ssr)
}
