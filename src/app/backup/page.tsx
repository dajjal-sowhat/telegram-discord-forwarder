import {Button, FileInput, Input, Select, Textarea, TextInput} from "@mantine/core";
import {NextResponse} from "next/server";
import {getBots} from "@/app/forwarder/action";
import {BackupTable} from "@/app/api/backup/route";
import {revalidatePath} from "next/cache";
import Discord from "discord.js";
import {getBot, getDiscordBot, getDiscordClientOptions} from "@/core/bot/client";
import {randomInt} from "node:crypto";
import {redirect} from "next/navigation";

async function Page(props: any) {
	const data = await Promise.all(Object.entries(BackupTable).map(async ([key, table]) => {

		return [
			key,
			await prisma[table as "bot"].count()
		] as const
	}));


	return (
		<div>
			{data.map(([key, count]) => (
				<p>{key}: {count}</p>
			))}
			<br/>
			<a download={'Backup.json'} href={'/api/backup'}>
				<Button>
					Backup Data
				</Button>
			</a>
			<hr className={'my-5'}/>
			<form className={'flex gap-2 max-w-[400px] items-end'} action={async (d) => {
				'use server'
				const file = d.get('file') as File;
				if (!file) return;

				await handleRestoreData(file);

				revalidatePath("./")
			}}>
				<FileInput
					label={'Restore Backup data'}
					name={'file'}
					required
					placeholder={'Select File'}
					accept={'.json'}
				/>
				<Button type={'submit'}>
					Restore
				</Button>
			</form>


			<hr className={'my-5'}/>

			<form className={'flex gap-2 max-w-[400px] items-end'} action={async (d) => {
				'use server'
				const file = d.get('file') as File;
				if (!file) return;

				await restoreOldData(file);

				revalidatePath("./")
			}}>
				<FileInput
					label={'Restore Backup data (OLD SOURCE)'}
					name={'file'}
					required
					placeholder={'Select File'}
					accept={'.json'}
				/>
				<Button type={'submit'}>
					Restore old data
				</Button>
			</form>
			<hr className={'my-10'}/>
			<form action={async (form) => {
				'use server';
				const obj = Object.fromEntries(Array.from(form.entries()));
				const query = JSON.parse(eval(`JSON.stringify(${obj.query})`));
				let  R: any;
				try {
					console.log(obj.table,obj.func,query);
					R = await prisma[obj.table as "forwardAction"][obj.func as "findFirst"](query as any);
				} catch (e: any) {
					console.log(e?.message ?? e);
					R = e
				}
				console.log(JSON.stringify(R));
			}}>
				<Select
					label={'Table'}
					name={'table'}
					data={Object.keys(prisma)}
				/>
				<Select
					label={'Function'}
					name={'func'}
					data={Object.keys(prisma.forwardAction)}
				/>
				<br/>
				<Textarea name={'query'} rows={10} />
				<Button type={'submit'}>
					Prisma
				</Button>
			</form>
		</div>
	);
}


async function handleRestoreData(file: File) {
	const json = JSON.parse(Buffer.from(await file.arrayBuffer()).toString('utf-8'));
	let _bots: Awaited<ReturnType<typeof getBots>>;

	for (let [key, table] of Object.entries(BackupTable)) {
		const data = json[key] as any[];
		if (!data) {
			console.warn(`${key} is not in backup`);
			continue;
		}

		console.log(table, data?.length);
		await Promise.all(data.map(async item => {
			let where = {id: item?.id || item};

			if (table === "forwardChannel") {
				if (!item.botId) {
					const bots = _bots || await getBots();
					_bots = bots;
					const targetBot = bots.find(o => o.type === item.type);
					if (targetBot) {
						item.botId = targetBot.id;
						item.type = targetBot.type;
					} else console.warn("Bot not found");
				}

				if ('id' in item) {
					item.channelId = item.id;
					delete item.id;
				}

				where = {
					id: {
						channelId: item.channelId,
						botId: item.botId
					}
				}
			}

			if (table === "forwardAction" || table === "forwardActionDestination") {
				if (!item.botId) {
					const source = await prisma.forwardChannel.findFirst({
						where: {
							channelId: item.sourceId || item.destinationId
						}
					});
					if (!source) {
						console.warn(`${table} BOTID CHANNEL NOT FOUND`,item);
						return;
					}

					item.botId = source.botId
				}

				if (table === "forwardActionDestination") {
					where = {
						id: {
							...where.id,
							botId: undefined
						}
					}
				}
			}

			const args = {
				where,
				create: item,
				update: item
			};

			await prisma[table as "forwardAction"].upsert(args).catch((e) => {
				console.error("ERROR", e?.message ?? e)
			});
		})).catch(console.error);
	}

	console.log("Success");
}

type OldDataType = Partial<{
	token: string
	redirects: Array<{
		sources: Array<string>
		destinations: Array<string>
		options: {
			webhook: boolean
			webhookUsernameChannel: boolean
			allowMentions: boolean
			copyEmbed: boolean
			copyAttachments: boolean
			allowList: Array<string>
			filters?: {
				link1: boolean
				link2: boolean
				blockedUser: Array<any>
				texts: Array<any>
				removeMedia: Array<any>
				onlyBot?: boolean
			}
		}
	}>
}>


async function restoreOldData(file: File) {
	const json = JSON.parse(Buffer.from(await file.arrayBuffer()).toString('utf-8')) as OldDataType

	const {token, redirects} = json;

	if (!token || !Array.isArray(redirects)) throw ("Invalid Data Structure");

	let bot = await prisma.bot.findUnique({
		where: {
			token
		}
	});

	let client = bot ? await getDiscordBot(bot) : undefined;

	if (!client) {
		const temp = new Discord.Client(getDiscordClientOptions("SELF_DISCORD"));
		await temp.login(token);

		if (!temp.user) throw ("Client User not found");

		bot = await prisma.bot.create({
			data: {
				token,
				type: "SELF_DISCORD",
				name: temp.user.username,
				id: temp.user.id
			}
		});
		client = temp;
	}
	if (!bot || !client) throw ("Client/Bot Not Found");

	async function getOrCreateChannel(sourceId: string) {
		if (!bot || !client) return undefined;

		let source = await prisma.forwardChannel.findFirst({
			where: {
				channelId: sourceId,
				botId: bot.id,
			}
		}) || undefined;
		if (!source) {
			const data = await client.channels.fetch(sourceId).catch(() => undefined) || undefined;
			if (!data) return undefined;

			source = await prisma.forwardChannel.create({
				data: {
					botId: bot.id,
					channelId: sourceId,
					name: 'name' in data ? data.name + "" : 'title' in data ? data.title + "" : "Unknown Channel",
					type: "SELF_DISCORD"
				}
			});
		}

		return source;
	}

	let n = 0;
	for (let {sources, destinations} of redirects) {
		for (let sourceId of sources) {
			let source = await getOrCreateChannel(sourceId);
			if (!source) continue;

			const o = {
				sourceId,
				botId: bot.id
			}
			const nextId = await prisma.forwardAction.findFirst({
				select: {
					id: true
				},
				orderBy: {
					id: "desc"
				}
			}).then(e=>e?.id || 0) + 1;

			const target = await prisma.forwardAction.findUnique({
				where: {
					uniq: o
				}
			});

			const args = {
				data: {
					...o,
					id: nextId
				},
			};
			const action = target || await prisma.forwardAction.create(args).catch((e)=>{
				console.error(e?.message ?? e);
				return undefined;
			});
			if (!action) {
				console.error("Action not found",args);
				continue;
			}

			for (let destinationId of destinations) {
				const destination = await getOrCreateChannel(destinationId);
				if (!destination) continue;

				const id = {
					actionId: action.id,
					destinationId
				};
				await prisma.forwardActionDestination.upsert({
					where: {
						id
					},
					create: {...id,botId: bot.id},
					update: id
				});
				n++;
			}
		}
	}

	return n;
}

export default Page;
