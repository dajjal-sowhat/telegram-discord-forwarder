import {Application, ChannelType, ClientApplication} from "discord.js";
import * as Prisma from "./prisma/PrismaClient";
import {getDiscordBot, InitializeBots, terminateClient} from "./core/bot/client";

declare global {
	var PlanHandler: ReturnType<typeof setInterval>
	var SelfBotRestart: ReturnType<typeof setInterval>
	var EventSetAllowance: boolean
}
global.EventSetAllowance ??= false;

global.PlanHandler ||= setInterval(async () => {
	const payments = await prisma.payment.findMany({
		where: {
			status: "PAID",
			plan: {
				days: {
					gt: 0
				}
			}
		},
		include: {
			plan: {
				select: {
					days: true
				}
			}
		},
	}).catch(() => []);

	for (let payment of payments) {
		const exAt = new Date(payment.created_at);
		exAt.setDate(exAt.getDate() + payment.plan.days);

		if (exAt.getTime() < Date.now()) {
			await prisma.payment.delete(payment.id).catch(console.error);
		}
	}
}, 60 * 60 * 1000)

global.SelfBotRestart ||= setInterval(async function () {
	const bots = await prisma.bot.findMany({
		where: {
			OR: [
				{
					type: "SELF_DISCORD"
				},
				{
					type: "DISCORD"
				},
			]
		}
	});

	for (let bot of bots) {
		do {
			try {
				console.log(`Stopping ${bot.name}...`);
				await terminateClient(bot).catch(console.error);
				console.log(`Starting ${bot.name}...`);
				await getDiscordBot(bot);
				break;
			} catch (e: any) {
				console.error(`FAIL TO RESTART ${bot.name}[${bot.key}] Client`, e);
			}
		} while (true);
	}
}, 60 * 60 * 1000)

//@ts-ignore
Application.prototype._patch = () => {

}
//@ts-ignore
ClientApplication.prototype._patch = () => {

}

export async function register() {
	await Prisma.default.bot.findMany();
	InitializeBots().catch(console.error);
}
