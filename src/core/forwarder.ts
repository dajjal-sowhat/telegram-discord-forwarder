import prisma from "../prisma/PrismaClient";
import Discord, {ChannelType, TextChannel, WebhookMessageCreateOptions} from "discord.js";
import {ForwardChannel} from ".prisma/client";
import {
	handleTelegramEditMsgText,
	handleTelegramForward,
	handleTelegramForwardWithPhoto
} from "@/telegraf/destinationHandler";
import {SupportedMessage} from "./types";
import {ActionResult} from "@prisma/client";
import {handleWatermark} from "./watermark";
import CustomTelegraf from "../telegraf/CustomTelegraf";
import {getBot, isDiscordClient, isTelegramClient} from "./bot/client";
import {singleFlightFunc, sleep, timeoutFunc} from "@/prisma/utils";

export async function getActionOfSource(id: string) {
	return prisma.forwardAction.findFirst({
		where: {
			source: {
				channelId: id + ""
			}
		},
		include: {
			destinations: {
				include: {
					destination: true
				}
			},
			source: true
		}
	});
}

let DESTINATION_THREAD: Record<string, typeof DIRECT_handleAction> = {};
export async function convertMessageToBaseObject(client: CustomTelegraf | Discord.Client, destination: ForwardChannel, message: SupportedMessage) {
	const isWebhook = message instanceof Discord.Message && message.webhookId && message.content.startsWith("Replied") && message.content.split("\n").length > 1;
	const anyMsg = message as any;

	const repliedTo = message instanceof Discord.Message ? (
		isWebhook ? message.content.split("\n").at(0)?.split("/")?.at(-1):message.reference?.messageId
	) : (anyMsg?.channelPost)?.reply_to_message?.message_id || (anyMsg?.update?.channel_post as any)?.reply_to_message?.message_id;
	const replyDestination = repliedTo ? (await prisma.actionResult.findFirst({
		where: {
			destinationId: destination.channelId,
			sourceTrackId: repliedTo+""
		}
	}))?.destinationTrackId : undefined;

	if (message instanceof Discord.Message) {
		if (isWebhook && repliedTo) {
			message.content = message.content.split("\n").slice(2).join("\n");
		}
		const fromEmbed = message.embeds.find(e => !!(e.image ?? e.thumbnail));

		return {
			content: message.content+"" || undefined,
			replied: replyDestination,
			imageUrl:
				(message.attachments.filter(e => e.contentType?.includes('image')).at(0)?.url ?? fromEmbed?.image?.url ?? fromEmbed?.thumbnail?.url ) as string | Buffer,
			avatar: message.author.avatarURL({
				size: 64
			}) || undefined,
			name: (message.channel as TextChannel).name || message.author.username
		}
	} else  {
		if (isTelegramClient(client)) {
			const h = (o:any)=>o.width + o.height;
			const photos = (anyMsg?.channelPost?.photo as any[])?.sort((o1,o2) => h(o1) > h(o2) ? -1:1);
			const chatAvatarId = await client.telegram.getChat(message.chat.id).then(r => r.photo?.small_file_id + "").catch(() => "");

			return {
				content: ((anyMsg.text ?? anyMsg.channelPost?.caption ?? anyMsg?.update?.edited_channel_post?.text ?? anyMsg?.update?.channel_post?.text) as string | undefined),
				replied: replyDestination,
				imageUrl: photos?.length ? await client.telegram.getFileLink(photos?.at(0)?.file_id + "").then(r => r.toString()  as string | Buffer).catch(()=>undefined):undefined,
				avatar: chatAvatarId ? await client.telegram.getFileLink(
					chatAvatarId
				).catch(() => undefined).then(r => r?.toString()):undefined,
				name: anyMsg?.channelPost?.author_signature || message?.chat?.title || "Unknown"
			}
		} else throw(`Can't parse telegram message ${client}`);
	}
}

export const handleAction = async <Source extends ForwardChannel>(
	source: Source,
	_message: SupportedMessage,
	destination: ForwardChannel,
	previousResult?: ActionResult
) => {
	const thread_type = destination.type === "TELEGRAM" ? "TELEGRAM":"DISCORD"
	let thread = DESTINATION_THREAD[thread_type];
	if (!thread) {
		thread = singleFlightFunc(async (...args: Parameters<typeof DIRECT_handleAction>) => {
			console.log(`[${thread_type}] forward ${source.name} => ${destination.name}...`,previousResult);
			return timeoutFunc(
				()=>DIRECT_handleAction(...args),
				global.DiscordRateLimit ? 60000:15000,
				`${source.name} => ${destination.name} ACTION TIMEOUT`
			).then(e=>{
				console.log(`[${thread_type}] forward ${source.name} => ${destination.name}... done`);
				return e;
			});
		},1000, `ForwardHandle:${thread_type}`);
		DESTINATION_THREAD[thread_type] = thread;
	}
	return thread(source,_message,destination,previousResult);
}

const DIRECT_handleAction = async <Source extends ForwardChannel>(
	source: Source,
	_message: SupportedMessage,
	destination: ForwardChannel,
	previousResult?: ActionResult
)=>{
	const [sourceBot, destinationBot] = await Promise.all([
		prisma.bot.findUniqueOrThrow({
			where: {
				id: source.botId
			}
		}),
		prisma.bot.findUniqueOrThrow({
			where: {
				id: destination.botId
			}
		})
	]);
	if (sourceBot.stopped || destinationBot.stopped) {
		console.error(sourceBot.stopped ? `Source bot ${sourceBot.name} is stopped!` : `Destination bot ${destinationBot.name} is stopped!`);
		return;
	}

	const [sourceClient, destinationClient] = await Promise.all([
		getBot(source.botId),
		getBot(destination.botId)
	])
	if (source.channelId === destination.channelId) {
		console.log('SELF FORWARD NOT AVAILABLE!');
		return;
	}
	if (!sourceClient?.active || !destinationClient?.active) throw("Some of client are not active!");

	let message = await convertMessageToBaseObject(sourceClient, destination, _message);

	if (message.imageUrl && typeof message.imageUrl === 'string') {
		message.imageUrl = await handleWatermark(message.imageUrl).catch(()=>message.imageUrl);
	}
	
	if (_message instanceof Discord.Message) {
		[
			...Array.from(_message.mentions.channels.values()),
			...Array.from(_message.mentions.roles.values()),
			...Array.from(_message.mentions.members?.values() || [])
		].forEach((ch: any) => {
			message.content = message.content?.replaceAll(ch.toString(), ch.name ?? ch.displayName ?? ch?.user?.displayName ?? ch?.label ?? ch?.user?.username ?? ch?.nickname)
		})
	}

	function removeInvalidMentions() {
		if (message.content && message.content?.includes("<") && message.content?.includes(">")) {
			const i = message.content.indexOf("<");
			const i2 = message.content.indexOf(">",i);
			const inside = message.content.substring(i,i2+1);

			if (inside.includes("@") || inside.includes("#") || inside.includes(":")) {
				message.content = message.content.replaceAll(inside,"");
			}
			removeInvalidMentions();
		}
	}
	removeInvalidMentions();

	if (destination.type === "TELEGRAM") {
		if (!isTelegramClient(destinationClient)) throw("Client should be telegram client!");
		const replyId = message?.replied ? +message.replied : undefined;
		const imageUrl = message.imageUrl;
		message.content = `*${message.name}*\n${message.content || ""}`

		if (imageUrl) {
			return previousResult ?
				await handleTelegramEditMsgText(destinationClient,previousResult.destinationId, +previousResult.destinationTrackId, message.content, true).then(()=>previousResult.destinationTrackId):
				await handleTelegramForwardWithPhoto(destinationClient,destination.channelId, imageUrl, replyId, message.content);
		} else if (message.content) {
			return previousResult ?
				await handleTelegramEditMsgText(destinationClient,previousResult.destinationId, +previousResult.destinationTrackId, message.content).then(()=>previousResult.destinationTrackId):
				await handleTelegramForward(destinationClient,destination.channelId, message.content, replyId);
		} else {
			console.error("Message doesn't have content");
		}
	} else {
		if (!isDiscordClient(destinationClient)) throw("Client should be discord client!");
		if (global.DiscordRateLimit && Date.now() < global.DiscordRateLimit) {
			const ms = global.DiscordRateLimit - Date.now();
			console.warn(`Discord Rate Limit is active! Waiting for ${ms / 1000}s`);
			await sleep(ms);
			global.DiscordRateLimit = undefined;
		}
		const channel = await destinationClient.channels.fetch(destination.channelId).catch(()=>undefined);
		if (!channel) throw(`Destination Channel not found  [${destinationClient?.bot?.key || destinationClient?.bot?.name}] ${destination.channelId}`);
		if (channel.type !== ChannelType.GuildText) throw(`Invalid Channel type ${channel?.type}`)

		const webhooks = await channel.fetchWebhooks();
		const webhook = webhooks.first() || (await channel.createWebhook({
			name: "FORWARDER"
		}).catch(() => undefined));

		if (!webhook) throw("Webhook not found!");

		const reply = message.replied ? await channel.messages.fetch(message.replied).catch(()=>undefined):undefined;
		if (reply) {
			message.content = `Replied to ${reply.url}\n\n${message.content || ""}`
		}

		const options: WebhookMessageCreateOptions = {
			content: message.content || ".",
			avatarURL: message.avatar,
			username: message.name.replaceAll("discord", "").replaceAll("Discord", ""),
			...(message.imageUrl && {
				files: [message.imageUrl]
			})
		};
		const args = previousResult ? [previousResult.destinationTrackId,options] as const:[options] as const
		const func = (previousResult ? "editMessage":"send");
		// @ts-ignore
		const R = await webhook[func](...args).catch(console.error);

		return R?.id || undefined;
	}
};


export async function handleEditAction(sourceId: string, msg: SupportedMessage) {
	const result = await prisma.actionResult.findMany({
		where: {
			sourceTrackId: sourceId
		},
		include: {
			actionDestination: {
				include: {
					action: {
						include: {
							source: true
						}
					},
					destination: true
				}
			},

		}
	});
	if (!result) return;

	for (let actionResult of result) {
		await handleAction(actionResult.actionDestination.action.source, msg, actionResult.actionDestination.destination, actionResult)
			.catch(console.error)
	}
}
