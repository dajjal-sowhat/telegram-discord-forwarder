import Discord from "discord.js";
import { getActionOfSource, handleAction, handleEditAction } from "../../forwarder";
import prisma from "../../../prisma/PrismaClient";
import ClientEventHandler, { GetEvent, SetEvent } from "./events.handler";
import { createPayment } from "@/app/plan/action";
import { getBot, terminateClient } from "@/core/bot/client";
import { Throw } from "@/prisma/utils";


export default class DiscordEventHandler extends ClientEventHandler<Discord.Client> {

	@SetEvent("messageCreate")
	async onMessageCreate(e: GetEvent<'messageCreate'>[0]) {
		if (!e.guild) return;

		e.reference = await e.fetchReference().then((e) => ({
			...e,
			messageId: e.id
		}) as any).catch(() => e.reference);
		const action = await getActionOfSource(this?.client?.bot?.id || this.client?.user?.id || Throw("Bot id not found"), e.channelId + "");
		if (!action) return;

		await Promise.all(action.destinations.map(async ({ destination }) => {
			const result = await handleAction(action.source, e, destination).catch(console.error);
			if (!result) {
				console.error(`${action.source.name} => ${destination.name} action error`);
				return;
			}
			await prisma.actionResult.create({
				data: {
					sourceTrackId: e.id,
					destinationTrackId: result,
					actionId: action.id,
					destinationId: destination.channelId
				}
			}).catch(console.error);
		})).catch(console.error);
	}

	@SetEvent("messageUpdate")
	async onMessageEdit(...args: GetEvent<'messageUpdate'>) {
		const [e, e2] = args;

		const msg = e2 ?? Object.getPrototypeOf(e);

		await handleEditAction(msg.id, msg);
	}

	@SetEvent("interactionCreate")
	async onAction(...[e]: GetEvent<'interactionCreate'>) {
		if (e.isButton()) {
			const msg = await e.reply({
				flags: ['Ephemeral'],
				content: "Creating Payment Link..."
			});

			try {
				const [model, id] = e.customId.split(":");

				if (model === "plan") {
					const plan = await prisma.plan.findUnique({ where: { id } });
					if (!plan) throw ("Plan not Found");

					const payment = await createPayment(plan, {
						userName: e.user.username,
						userId: e.user.id
					}).catch((e: any) => `Failed to create payment ${e?.message ?? e}`);
					if (typeof payment === 'string') throw (payment);

					const exAt = new Date();
					exAt.setMinutes(exAt.getMinutes() + 30);

					const row = new Discord.ActionRowBuilder()
						.addComponents(
							new Discord.ButtonBuilder()
								.setLabel("Open Link")
								.setStyle(Discord.ButtonStyle.Link)
								.setURL(payment.link)
						)

					await msg.edit({
						embeds: [
							{
								description: `Here is your payment link.\nThis link will expire <t:${Math.floor(exAt.getTime() / 1000)}:R>`
							}
						],
						components: [row as any],
						content: "Payment Link Created!"
					})
				} else throw ("Invalid model action");
			} catch (e: any) {
				console.error(e);
				await msg.edit({
					content: e?.message ?? e
				});
			}
		}
	}

	@SetEvent("error")
	async error(e: GetEvent<'error'>) {
		const id = this.client.user?.id || this.client?.bot?.id || Throw("Where the fuck is bot id", this.client);
		const bot = await prisma.bot.findUnique({
			where: {
				id
			}
		}) || Throw("Bot not found",id);

		console.error(`GOT ERROR FROM DISCORD CLIENT ${bot.key}!`, e);
		console.warn('Reconnecting...');
		
		await terminateClient(bot).catch(console.error);
		getBot(bot).catch(() => console.error(`FAIL TO INITIALIZE BOT ${bot.key}`));
	}

	@SetEvent("channelDelete")
	async chDel(...[e]: GetEvent<"channelDelete">) {
		await prisma.forwardChannel.delete({
			where: {
				id: {
					botId: e.client.user.id,
					channelId: e.id
				}
			}
		}).catch(()=>undefined);
		console.warn(`${'name' in e ? e.name:"Unknown"} channel deleted`)
	}
}
