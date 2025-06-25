import ClientEventHandler, { GetEvent, SetEvent } from "./events.handler";
import CustomTelegraf from "../../../telegraf/CustomTelegraf";
import prisma from "../../../prisma/PrismaClient";
import { getActionOfSource, handleAction, handleEditAction } from "@/core/forwarder";
import { getBot } from "@/core/bot/client";


export class TelegramEventHandler extends ClientEventHandler<CustomTelegraf> {

	constructor(client: CustomTelegraf) {
		super(client);
		client.onDisconnect((e) => {
			const key = `${client.bot.type}|${client.bot.id}` as const;
			console.error(`${key} DISCONNECTED ${e?.message ?? e}`);
			client.active = false;
			try { client.stop() } catch { }
			delete global.INITIALIZED_CLIENTS[key];
			console.warn(`Reinitializing ${key}`);
			getBot(key).catch(() => console.error(`FAIL TO INITIALIZE ${key}!`))
		})
	}

	@SetEvent("channel_post")
	async onChannelPost(e: GetEvent<'channel_post'>) {
		const me = this.client.me;
		if (!me) throw ("Bot is not ready yet");

		try {
			const id = {
				channelId: e.chat.id + "",
				botId: this.client.bot.id
			}
			await prisma.forwardChannel.upsert({
				where: {
					id
				},
				create: {
					...id,
					name: e.chat.title,
					type: "TELEGRAM",
					botId: me.id + ""
				},
				update: {
					name: e.chat.title
				}
			})
		} catch (e) {
			console.error(e);
		}

		const id = e.chat.id + "";
		const action = await getActionOfSource(id).catch(() => undefined);
		if (!action) return;

		await Promise.all(action.destinations.map(async ({ destination }) => {
			const R = await handleAction(action.source, e, destination).catch(console.error);

			if (!R) {
				console.error(`${action.source.name} => ${destination.name} action error`);
				return;
			}

			const o = e as any;
			const p = {
				data: {
					sourceTrackId: (o?.message_id ?? (e?.update as any)?.message_id ?? (e?.update as any)?.channelPost?.message_id ?? e?.msgId) + "",
					destinationTrackId: R,
					actionId: action.id,
					destinationId: destination.channelId
				}
			};
			await prisma.actionResult.create(p as any)
		})).catch(console.error);
	}

	@SetEvent("edited_channel_post")
	async onChannelPostEdit(e: GetEvent<'edited_channel_post'>) {
		const id = e.update.edited_channel_post.message_id;
		await handleEditAction(id + "", e).catch(console.error);
	}

	@SetEvent("error")
	async error([e]: GetEvent<'error'>) {
		console.log(`${this.client.bot.key} error`, e);
		return true;
	}
}
