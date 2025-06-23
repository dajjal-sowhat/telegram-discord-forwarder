import CustomTelegraf from "../../telegraf/CustomTelegraf";
import Discord from "discord.js";
import {Bot} from ".prisma/client";
import DiscordEventHandler from "./event/events.discord";
import {isDiscordClient} from "./client";
import {TelegramEventHandler} from "./event/events.telegram";


export function handleClientEvent(bot: Bot, client: Discord.Client | CustomTelegraf) {
    const key = `${bot.type}|${bot.id}` as const;
    const gen = `${key}-${Date.now()}`;
    console.log(`Handling event of client ${gen}`);
    const handler = isDiscordClient(client) ? new DiscordEventHandler(client) : new TelegramEventHandler(client);
    handler.client.uniqKey = gen;
    const funcNames = Object.getOwnPropertyNames(Object.getPrototypeOf(handler));

    for (let funcName of funcNames) {
        const func = handler[funcName as keyof typeof handler];
        if ('event' in func) {
            //@ts-ignore
            client.on(func.event as any, (...args: any[]) => {
                if (client.uniqKey !== gen) {
                    console.warn(`Invalid Unique key detected! ${func.event}`);
                    return;
                }
                (func as unknown as Function).bind(handler)(...args);
            });
            console.log(func.event, `has been set on ${bot.name} client!`);
        }
    }
}