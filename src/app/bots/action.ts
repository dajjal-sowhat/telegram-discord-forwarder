'use server';


import {Prisma} from ".prisma/client";
import Discord from "discord.js";
import {getBot, getDiscordClientOptions} from "@/core/bot/client";
import CustomTelegraf from "@/telegraf/CustomTelegraf";
import {PrismaModelType} from "@/prisma/PrismaClient";
import {BotType} from "@prisma/client";

export async function addBot(type: BotType, token: string) {
	let bot: Prisma.BotCreateArgs['data'] | undefined = undefined;

	switch (type) {
		case "DISCORD":
		case "SELF_DISCORD":{

			const client = new Discord.Client(getDiscordClientOptions(type));
			await client.login(token);


			const user = client.user;
			if (!user) throw("Fail to fetch user data from discord client");

			bot = {
				id: user.id+"",
				token,
				name: user.username,
				type,
				created_at: new Date()
			}
			await client.destroy().catch(console.error);

			break;
		}
		case "TELEGRAM":
			const client = new CustomTelegraf({} as PrismaModelType<'bot'>,token);
			const me = await client.waitToReady();

			bot = {
				id: me.id+"",
				type,
				token,
				name: me.username,
				created_at: new Date()
			}
			try{client.stop();}catch{}
			break;
		default:
			throw("Unknown Client type");
	}

	if (!bot) throw("Fail to initialize bot data");

	const {token: t1,...safeBot} = await prisma.bot.create({data:bot});
	await getBot({
		...bot,
		key: `${bot.type}|${bot.id}` as const
	} as any)
	return safeBot;
}
