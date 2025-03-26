import CustomTelegraf from "./CustomTelegraf";

const o = {reply_parameters: {message_id: 73, chat_id: -1002170940186}, caption: "undefined\nReplyId: 73", photo: {
	url: "https://api.telegram.org/file/bot7246203885:AAF76_--EXN2sSfQz2D-K8x_QM_u2VRLS8o/photos/file_3.jpg"
	}, chat_id: "-1002170940186"}

export async function handleTelegramForwardWithPhoto(telegramBot: CustomTelegraf, chatId: string, image: string | Buffer, replyId?: number, content?: string) {
	return await telegramBot.telegram.callApi('sendPhoto', {
		...replyId && ({
			reply_parameters: {
				message_id: replyId,
				chat_id: +chatId
			},
			reply_to_message_id: replyId
		}),

		...content && ({
			caption: content
		}),
		photo: image instanceof Buffer ? {
			source: image
		}: {
			url: image
		},
		chat_id: chatId,
		parse_mode: "Markdown"
	}).catch(console.error).then(r => r ? r.message_id+"":undefined);
}

export async function handleTelegramForward(telegramBot: CustomTelegraf,chatId: string, content: string, replyId?: number) {
	return await telegramBot.telegram.sendMessage(chatId, content, {
		...(replyId ? {
			reply_parameters: {
				message_id: replyId
			}
		} : {}),
		parse_mode: "Markdown"
	}).catch(console.error).then(r => r ? r.message_id + "" : undefined)
}

export async function handleTelegramEditMsgText(telegramBot: CustomTelegraf,chatId: string, msgId: number, content: string, hasPhoto: boolean = false) {
	return await telegramBot.telegram[hasPhoto ? "editMessageCaption":"editMessageText"](chatId,msgId, undefined, content, {
		parse_mode: "Markdown"
	});
}
