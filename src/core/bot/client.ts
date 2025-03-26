import {Bot} from ".prisma/client";
import {BotType} from "@prisma/client";
import Discord, {Client, ClientOptions} from "discord.js";
import CustomTelegraf from "../../telegraf/CustomTelegraf";
import {Telegraf} from "telegraf";
import {handleClientEvent} from "./events";
import {PrismaModelType} from "@/prisma/PrismaClient";
import {clearTimeout} from "node:timers";

declare global {
	var INITIALIZED_CLIENTS: {
		[id: `${Bot['type']}|${Bot['id']}`]: Discord.Client | CustomTelegraf
	}
	var INITIALIZE_CLIENTS_LOADING: {
		[id: `${Bot['type']}|${Bot['id']}`]: boolean
	}
}
global.INITIALIZED_CLIENTS ||= {};
global.INITIALIZE_CLIENTS_LOADING ||= {};

declare module "discord.js" {
	interface Client {
		bot: Bot & {
			key: keyof typeof INITIALIZED_CLIENTS
		},
		active?: boolean,
		uniqKey?: string
	}
}

export async function getBot(_bot: string | PrismaModelType<'bot'>, type?: BotType) {
	const bot = typeof _bot === 'string' ? await prisma.bot.findUnique({
		where: {
			id: _bot.split("|").at(-1),
			type
		}
	}) : _bot;
	if (!bot) throw (`${_bot} Not Found, Unknown Bot!`);

	await waitForClientLoading(bot);

	if (bot.type === "DISCORD" || bot.type === "SELF_DISCORD") {
		return await getDiscordBot(bot);
	} else if (bot.type === "TELEGRAM") {
		return await getTelegramBot(bot);
	} else throw ("Unsupported Bot Type");
}

export async function waitForClientLoading(bot: PrismaModelType<'bot'>) {
	const key = `${bot.type}|${bot.id}` as const;
	const isLoading = global.INITIALIZE_CLIENTS_LOADING[key];
	if (isLoading) {
		let n = 0;
		console.log(`Waiting for ${key} to initialize...`);
		do {
			if (!global.INITIALIZE_CLIENTS_LOADING[key]) break;
			await new Promise(r => setTimeout(r, 1000));
			n += 1;
			if (n > 30) throw (`Waiting for ${key} to initialize... Timeout`);
		} while (true);
		console.log(`Waiting for ${key} to initialize... Done`);
	}

	const client = global.INITIALIZED_CLIENTS[bot.key];
	if (client && isDiscordClient(client) && !client.isReady()) {

		let n = 0;
		console.log(`Waiting for ${key} to ready...`);
		do {
			await new Promise(r => setTimeout(r, 1000));
			n += 1;
			if (n > 30) throw (`Waiting for ${key} to ready... Timeout`);
		} while (!client.isReady());
		console.log(`Waiting for ${key} to ready... isReady`);
	}
}

export async function getDiscordBot(bot: PrismaModelType<'bot'>, _try = 0) {
	if (_try > 5) throw (`looks like the client ${bot.name}(${bot.key}) unavailable!`);

	const types: BotType[] = ['DISCORD', "SELF_DISCORD"];
	if (!types.includes(bot.type)) throw (`Supported type for discord client is ${types}, ${bot.type} doesn't supported`);

	const key = `${bot.type}|${bot.id}` as const;

	let client = INITIALIZED_CLIENTS[key];

	if (!client) {
		await waitForClientLoading(bot);
		INITIALIZE_CLIENTS_LOADING[key] = true;
		console.log(`Initializing ${bot.type} ${bot.name}...`)
		client = new Discord.Client(getDiscordClientOptions(bot.type as "DISCORD"));
		client.bot = {
			...bot,
			key
		};
		console.log(`Logging into ${bot.name}|${bot.type} client...`);
		await new Promise(((resolve, reject) => {
			const t = setTimeout(() => {
				reject(`${client.bot.key} Waiting Timeout!`);
			}, 30000);
			if (isDiscordClient(client)) {
				client.login(bot.token).then(() => {
					clearTimeout(t);
					resolve(true)
				}).catch((...args) => {
					clearTimeout(t);
					reject(...args);
				});
			} else {
				clearTimeout(t);
				reject("Invalid type");
			}
		}))
			.catch(async (e) => {
				INITIALIZE_CLIENTS_LOADING[key] = false;
				return await getDiscordBot(bot, _try + 1);
			}).finally(() => {
				INITIALIZE_CLIENTS_LOADING[key] = false;
			})

		client.active = true;
		INITIALIZED_CLIENTS[key] = client;
		await waitForClientLoading(bot).catch(console.error);
		handleClientEvent(bot, client);
		console.log(`Initializing ${bot.type} ${bot.name}... Done`)
	}

	if (isDiscordClient(client)) {
		return client;
	} else throw ("The Initialized client is not an discord client");
}

export async function getTelegramBot(bot: PrismaModelType<'bot'>) {
	if (bot.type !== 'TELEGRAM') throw (`Unknown telegram bot ${bot.type}/${bot.id}`);

	const key = `${bot.type}|${bot.id}` as const;

	let client = INITIALIZED_CLIENTS[key];

	if (!client) {
		await waitForClientLoading(bot);
		INITIALIZE_CLIENTS_LOADING[key] = true;
		console.log(`Initializing telegram bot ${bot.name}...`)
		client = new CustomTelegraf(bot, bot.token);
		await client.waitToReady();
		INITIALIZED_CLIENTS[key] = client;
		handleClientEvent(bot, client);
		client.active = true;
		console.log(`Initializing telegram bot ${bot.name}... Done`);
		INITIALIZE_CLIENTS_LOADING[key] = false;
	}

	if (isTelegramClient(client)) {
		return client;
	} else throw (`The Client doesn't seems to be an telegram client!`);
}


export async function InitializeBots() {
	const bots = await prisma.bot.findMany();

	await Promise.all(bots.map(async (bot) =>
		getBot(bot).catch((e) => {
			console.error(`Fail to initialize bot ${bot.key}`, e)
		})
	)).catch(() => undefined);

	console.log(`Bots(${bots.length}) has been initialized!`);
	global.EventSetAllowance = true;
}

export function isTelegramClient(client: unknown): client is CustomTelegraf {
	return !!client && typeof client === 'object' && Object.getPrototypeOf(client).constructor.name === "CustomTelegraf";
}

export function isDiscordClient(client: unknown): client is Discord.Client {
	return !!client && typeof client === 'object' && 'isReady' in client && 'destroy' in client;
}


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
			status: "online"
		},
		shards: 'auto'
	}
}

export async function terminateClient(bot: PrismaModelType<'bot'>) {
	const client = await getBot(bot);
	if (!client) return;


	try {
		await waitForClientLoading(bot).catch(console.error);
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

	delete global.INITIALIZED_CLIENTS[bot.key];
	delete global.INITIALIZE_CLIENTS_LOADING[bot.key];
}
