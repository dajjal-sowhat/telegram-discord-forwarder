'use server';

import Discord from "discord.js";
import {getBot, isDiscordClient} from "@/core/bot/client";



export async function getBotGuilds(...args: Parameters<typeof getBot>) {
	const bot = await getBot(...args);
	if (!isDiscordClient(bot)) throw("Its not an discord client");

	return bot.guilds.cache.map(o => ({
		id: o.id,
		avatar: o.iconURL({
			size: 256
		}),
		name: o.name,
		members: o.memberCount
	}))
}
