'use server';

import {getBot, isDiscordClient} from "@/core/bot/client";

export async function getGuildRoles(bot: string, guild: string) {
	const client = await getBot(bot);
	if (!isDiscordClient(client)) return [];

	const server = await  client.guilds.fetch(guild);

	return server.roles.cache.map(o=>({
		name: o.name,
		id: o.id,
		color: o.hexColor
	}))
}
