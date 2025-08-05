'use server';

import prisma, { PrismaModelType } from "../../prisma/PrismaClient";
import { ChannelType, TextChannel } from "discord.js";
import { Bot, ForwardChannel, Prisma } from ".prisma/client";
import { getBot, getDiscordBot, isDiscordClient } from "@/core/bot/client";
import { ssr } from "@/prisma/utils";

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
		}).filter(o => !!o)
	} else {
		return prisma.forwardChannel.findMany({
			where: {
				botId: bot.id
			}
		})
	}
}


export async function handleForwardRegister(sourceBot: PrismaModelType<'bot'>, destinationBot: PrismaModelType<'bot'>, sourceId: string | ForwardChannel, destinationId: string | ForwardChannel) {
	const source = typeof sourceId === 'string' ? await getForwardChannel(sourceBot, sourceId) : sourceId;
	const des = typeof destinationId === 'string' ? await getForwardChannel(destinationBot, destinationId) : destinationId;

	const uniq = {
		sourceId: source.channelId,
		botId: sourceBot.id
	};
	
	let action = await prisma.forwardAction.findUnique({
		where: {
			uniq
		}
	}) || await prisma.forwardAction.create({
		data: uniq
	});

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

export async function handleCategoryForward(sourceBot: PrismaModelType<'bot'>, destinationBot: PrismaModelType<'bot'>, categoryId: string, destinationId: string) {
	const sourceClient = await getDiscordBot(sourceBot);
	const textChannels = Array.from(sourceClient.channels.cache.filter(o => o.type === ChannelType.GuildText).values());
	const targets = textChannels.filter(t => t.parentId === categoryId);
	const destination = await getForwardChannel(destinationBot, destinationId);

	await Promise.all(targets.map(async t => {
		return await handleForwardRegister(sourceBot, destinationBot, t.id, destination)
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

export async function getForwardChannel(bot: PrismaModelType<'bot'>, id: string) {
	const channels = await getAvailableChannels(bot);


	let targetChannel = channels.find(o => o?.channelId === id);
	if (!targetChannel) throw (`${bot.name} channels ${id} Channel not found`);

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
	return await prisma.bot.findMany().then(e => e.map(o => ({ ...o, token: "" }))).then(ssr)
}

export async function getGuilds(botId: string) {
	const client = await getBot(botId);
	if (!isDiscordClient(client)) throw (`The client is not a discord client!`);

	return await client.guilds.cache.map(g => ({
		value: g.id,
		label: g.name
	}));
}

export async function handleGuildForward(_sourceBot: PrismaModelType<'bot'>, _destinationBot: PrismaModelType<'bot'>, sourceGuild: string, destinationGuild: string) {
	const sourceBot = await getDiscordBot(_sourceBot);
	const destinationBot = await getDiscordBot(_destinationBot);
	const sourceChannels = [...sourceBot.channels.cache.filter((o) => o.type === ChannelType.GuildText && o.guild.id === sourceGuild).values()] as TextChannel[];
	const destinationChannels = [...destinationBot.channels.cache.filter(o => o.type === ChannelType.GuildText && o.guild.id === destinationGuild).values()] as TextChannel[];

	let n = 0;
	for (const sourceChannel of sourceChannels) {
		const destinationChannel = destinationChannels.find(o => o.name === sourceChannel.name);
		if (!destinationChannel) continue;

		try {
			await handleForwardRegister(_sourceBot, _destinationBot, sourceChannel.id, destinationChannel.id);
			n++;
		} catch (e: any) {
			console.error(`Error while registering forward S:${sourceChannel.name} | D:${destinationChannel.name}`);
		}
	}

	return {
		total: sourceChannels.length,
		created: n,
	}
}