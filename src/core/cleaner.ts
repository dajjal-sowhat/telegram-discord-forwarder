import { singleFlightFunc } from "@/prisma/utils";
import { getBot, isDiscordClient, isTelegramClient } from "./bot/client";
import { ForwardChannel } from "@prisma/client";

declare global {
    var cleanerThread: ReturnType<typeof setInterval>
}

async function getChannels() {
    return await prisma.forwardChannel.findMany({
        include: {
            bot: true,
            _count: {
                select: {
                    actions: true,
                    destinations: true
                }
            }
        }
    });
}

const state = {}
const thread = singleFlightFunc(async function (this: typeof state) {
    const channels = await getChannels();
    for (const channel of channels) {
        const exists = await exist(channel).catch(() => undefined);
        if (exists === false) {
            await prisma.forwardChannel.delete({
                where: {
                    id: {
                        botId: channel.botId,
                        channelId: channel.channelId
                    }
                },
            });
            console.warn(`Channel "${channel.name}" of bot ${channel.bot.name} not found, DELETED (S:${channel._count.actions} => D:${channel._count.destinations})`);
        }
    }


    const uselessActions = await prisma.forwardAction.findMany({
        include: {
            _count: {
                select: {
                    destinations: true
                }
            }
        }
    })
    for (const action of uselessActions) {
        if (action._count.destinations !== 0) continue;
        const count = await prisma.forwardActionDestination.count({
            where: {
                actionId: action.id
            }
        });
        if (count !== 0) continue;
        const R = await prisma.forwardAction.delete({
            where: {
                id: action.id
            },
            include: {
                source: true
            }
        });
        console.warn("useless action deleted", "S:", R.source.name);
    }
})

type AC = Awaited<ReturnType<typeof getChannels>>[number];
async function exist(forwardChannel: AC) {
    const client = await getBot(forwardChannel.bot);

    if (isDiscordClient(client)) {
        const channel = client.channels.cache.get(forwardChannel.channelId) || await client.channels.fetch(forwardChannel.channelId).catch(() => undefined);
        return !!channel;
    } else if (isTelegramClient(client)) {
        const chat = await client.telegram.getChat(forwardChannel.channelId).catch(()=>undefined);
        return !!chat;
    } else throw (`Unknown client type ${forwardChannel.bot.type}`)
}

async function initializeCleaner() {
    const handler = thread.bind(state);
    global.cleanerThread ||= setInterval(handler, 60 * 60 * 60_000);
    return handler();
}

export default initializeCleaner;