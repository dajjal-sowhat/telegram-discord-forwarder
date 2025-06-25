import { Bot } from ".prisma/client";
import { BotType } from "@prisma/client";
import Discord, { ActivityType, ClientOptions } from "discord.js";
import CustomTelegraf from "../../telegraf/CustomTelegraf";
import { handleClientEvent } from "./events";
import { PrismaModelType } from "@/prisma/PrismaClient";
import { singleFlightFunc, timeoutFunc } from "@/prisma/utils";

declare global {
    var INITIALIZED_CLIENTS: {
        [id: `${Bot['type']}|${Bot['id']}`]: Discord.Client | CustomTelegraf
    }
    var Refresher: ReturnType<typeof setInterval>
    var Runner: ReturnType<typeof setInterval>
}
global.INITIALIZED_CLIENTS ||= {};
global.Refresher ||= setInterval(async function (this: { loading: boolean }) {
    if (this.loading) return;
    this.loading = true;

    for (let [key, client] of Object.entries(global.INITIALIZED_CLIENTS || {})) {
        const id = key.split("|").at(-1);
        if (!id) continue;
        const bot = await prisma.bot.findUnique({
            where: {
                id,
                stopped: false
            }
        });
        if (!bot) {
            console.error(`[REFRESHER]: Fail to find ${key} in db`);
            continue;
        }
        console.log(`[REFRESHER]: Reinitialize ${key}...`);
        try {
            await terminateClient(bot);
            await prisma.bot.update({
                where: {
                    id: bot.id
                },
                data: {
                    stopped: false
                }
            })
            await getBot(bot)
        } catch (e) {
            console.error(`[REFRESHER]: ${key}`, e)
        }
    }

    this.loading = false;
}, 60 * 60 * 1000);
global.Runner ||= setInterval(async function (this: { loading: boolean }) {
    if (this.loading) return;
    this.loading = true;
    const bots = await prisma.bot.findMany({
        where: {
            stopped: false
        }
    });

    for (const bot of bots) {
        await getBot(bot);
    }

    this.loading = false;
}, 60000);

declare module "discord.js" {
    interface Client {
        bot: Bot & {
            key: keyof typeof INITIALIZED_CLIENTS
        },
        active?: boolean,
        uniqKey?: string
    }
}

export const getBot = singleFlightFunc(async function getBot(_bot: string | PrismaModelType<'bot'>, type?: BotType) {
    const bot = typeof _bot === 'string' ? await prisma.bot.findUnique({
        where: {
            id: _bot.split("|").at(-1),
            type
        }
    }) : _bot;
    if (!bot) throw (`${_bot} Not Found, Unknown Bot!`);

    if (bot.type === "DISCORD" || bot.type === "SELF_DISCORD") {
        return await getDiscordBot(bot);
    } else if (bot.type === "TELEGRAM") {
        return await getTelegramBot(bot);
    } else throw ("Unsupported Bot Type");
})

export const getDiscordBot = singleFlightFunc(async function getDiscordBot(bot: PrismaModelType<'bot'>, _try = 0) {
    if (_try > 5) throw (`looks like the client ${bot.name}(${bot.key}) unavailable!`);

    const types: BotType[] = ['DISCORD', "SELF_DISCORD"];
    if (!types.includes(bot.type)) throw (`Supported type for discord client is ${types}, ${bot.type} doesn't supported`);

    const key = `${bot.type}|${bot.id}` as const;

    let client = INITIALIZED_CLIENTS[key] as Discord.Client;

    if (!client) {
        console.log(`Initializing ${bot.type} ${bot.name}...`)
        client = new Discord.Client(getDiscordClientOptions(bot.type as "DISCORD"));
        client.bot = {
            ...bot,
            key
        };
        console.log(`Logging into ${bot.name}|${bot.type} client...`);
        const R = await timeoutFunc(async () =>
            client.login(bot.token)
            , 120000, "DISCORD_CLIENT LOGIN TIMEOUT")
            .catch(console.error)

        if (!R) {
            console.error(`Login Fail[${bot.key}] Retrying... (${_try}/5)`);
            return await getDiscordBot(bot, _try + 1);
        }

        client.active = true;
        INITIALIZED_CLIENTS[key] = client;
        handleClientEvent(bot, client);
        console.log(`Initializing ${bot.type} ${bot.name}... Done`)
        await prisma.bot.update({
            where: {
                id: bot.id
            },
            data: {
                stopped: false
            }
        })
    }

    if (isDiscordClient(client)) {
        return client;
    } else throw ("The Initialized client is not an discord client");
})

export const getTelegramBot = singleFlightFunc(async function getTelBot(bot: PrismaModelType<'bot'>) {
    if (bot.type !== 'TELEGRAM') throw (`Unknown telegram bot ${bot.type}/${bot.id}`);

    const key = `${bot.type}|${bot.id}` as const;

    let client = INITIALIZED_CLIENTS[key];

    if (!client) {
        console.log(`Initializing telegram bot ${bot.name}...`)
        client = new CustomTelegraf(bot, bot.token);
        await client.waitToReady();
        INITIALIZED_CLIENTS[key] = client;
        handleClientEvent(bot, client);
        client.active = true;
        console.log(`Initializing telegram bot ${bot.name}... Done`);
        await prisma.bot.update({
            where: {
                id: bot.id
            },
            data: {
                stopped: false
            }
        })
    }

    if (isTelegramClient(client)) {
        return client;
    } else throw (`The Client doesn't seems to be an telegram client!`);
})


export async function InitializeBots() {
    const bots = await prisma.bot.findMany({
        where: {
            stopped: false
        }
    });

    await Promise.all(bots.map(async (bot) =>
        getBot(bot).catch((e) => {
            console.error(`Fail to initialize bot ${bot.key}`, e)
        })
    )).catch(() => undefined);

    console.log(`Bots(${bots.length}) has been initialized!`);
}

export function isTelegramClient(client: unknown): client is CustomTelegraf {
    return !!client && typeof client === 'object' && Object.getPrototypeOf(client).constructor.name === "CustomTelegraf";
}

export function isDiscordClient(client: unknown): client is Discord.Client {
    return !!client && typeof client === 'object' && 'isReady' in client && 'destroy' in client;
}

const singleThreadFetch = singleFlightFunc(async function discordFetch(...[url, init]: Parameters<typeof fetch>) {
    return await fetch(url, init) as any;
}, 1000);

export function getDiscordClientOptions(type: "DISCORD" | "SELF_DISCORD"): ClientOptions {
    const intents: ClientOptions['intents'] = ['MessageContent', 'GuildMessages', "Guilds", "GuildMembers"] as const;
    const needs = type === "SELF_DISCORD" ? {
        intents,
        rest: {
            authPrefix: "" as unknown as "Bot"
        }
    } : {
        intents
    };
    return {
        ...needs,
        presence: {
            status: "dnd",
            activities: [
                {
                    type: ActivityType.Watching,
                    name: "Signals"
                }
            ]
        },
        rest: {
            ...needs.rest || {},
            globalRequestsPerSecond: 1,
            makeRequest: singleThreadFetch as any,
        }
    }
}

export async function terminateClient(bot: PrismaModelType<'bot'>) {
    const client = await getBot(bot);
    if (!client) return;


    try {
        client.active = false;
        if (isDiscordClient(client)) {
            client.removeAllListeners();
            await client.destroy().catch(console.error);
        } else {
            client.stop("Terminated");
        }
    } catch (e) {
        console.error(`Failed to terminate client ${bot.key}`, e)
    }
    await prisma.bot.update({
        where: {
            id: bot.id
        },
        data: {
            stopped: true
        }
    })
    delete global.INITIALIZED_CLIENTS[bot.key];
}
