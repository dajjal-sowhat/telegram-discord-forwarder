import {ClonerFilters} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/SelectFilter";
import * as OriginConsole from "console";
import {getBot, getDiscordBot, isDiscordClient} from "@/core/bot/client";
import {CloneTask, Prisma} from "@prisma/client";
import {PrismaModelType} from "@/prisma/PrismaClient";
import {ChannelType, GuildChannel, TextChannel} from "discord.js";

declare global {
	var tasks: {
		[k: CloneTask['id']]: CloneTaskHandler;
	}
}
global.tasks ||= {};

export const ClonerParams = {
	spyBot: "",
	sourceServer: "",
	copierBot: "",
	targetServer: ""
}

export const ClonerBody = {
	filters: [] as (keyof typeof ClonerFilters)[],
	channels: [] as string[]
}

export class CloneTaskHandler {
	task: PrismaModelType<'cloneTask'>;
	completeActions = 0;
	totalActions = 0;
	logFunction: ((str: string, percent: number) => any) | undefined = undefined;
	calcTotalAction = false;
	actionSleep = 1500;
	tracks: {
		[k: string]: string
	} = {}

	constructor(task: typeof this.task) {
		this.task = task;
		global.tasks[task.id] = this;
	}

	set log(log: any) {
		if (this.calcTotalAction) return;
		log = log + "";
		try {
			this.logFunction?.(log, this.percent);
		} catch {
		}
		OriginConsole.log(`TASK:${this.task.id}: ${log}`);
	}

	get percent() {
		return this.task.status === "FINISHED" ? 100 : Math.ceil(this.completeActions / this.totalActions * 100) || 0
	}

	get endAt() {
		if (this.status !== 'RUNNING') return "Ended";
		const secs = this.actionSleep * (this.totalActions - this.completeActions) / 1000;
		const min = Math.floor(secs / 60);
		return `${min}min ${Math.ceil(secs - (min * 60))}sec`
	}

	async doAction<T extends object | string>(actionName: string, array: T[], each: (o: T, i: number) => any, duplicate?: (o: T) => boolean) {
		if (this.calcTotalAction) {
			this.totalActions += array.length;
			return;
		}
		this.log = (`Handle ${actionName}, Total Action: ${array.length}`)
		let n = 0;
		for (let item of array) {
			if (this.task.status !== 'RUNNING') this.error("Task is not running");
			n++;
			try {
				this.log = (`${actionName}(${n}/${array.length})...`)
				if (duplicate?.(item)) {
					this.log = (`${actionName}(${n}/${array.length})... Duplicate!`);
					continue;
				}
				await new Promise(r => setTimeout(r, this.actionSleep));
				await new Promise((r, reject) => {
					const R = each(item, n - 1);
					if (R instanceof Promise) {
						const t = setTimeout(() => reject(`${actionName}(${n}/${array.length})... Error! Action Timeout`), this.actionSleep * 5);
						R.finally(() => clearTimeout(t)).then(r).catch(reject);
					} else r(true);
				})
				this.log = (`${actionName}(${n}/${array.length})... Done`)
			} catch (e: any) {
				this.log = (`${actionName}(${n}/${array.length})... Error!`)
				this.log = e?.message ?? e;
			}
			this.completeActions++;
		}
	}

	async doList(name: string, array: (() => any)[]) {
		await this.doAction(name, array, async func => {
			await func();
		})
	}

	set status(o: CloneTask['status']) {
		if (this.calcTotalAction) return;

		const pre = this.task.status;
		if (pre === o) return;

		this.task.status = o;
		prisma.cloneTask.update({
			where: {id: this.task.id},
			data: {status: o}
		}).catch(this.error).then(() => {
			if (o === "RUNNING") this.handler.bind(this)().catch(console.error);
		});
		this.log = `Task ${o}`;
		if (o === "FINISHED") delete global.tasks[this.task.id];
	}

	get status() {
		return this.task.status
	}

	error(e?: any): never {
		console.error("ERROR!", e);
		const reason = e?.message ?? e;
		this.log = `Error: ${reason || "Unknown Reason"}`;
		this.status = "ERROR";
		throw (reason);
	}

	async handler() {
		if (!this.calcTotalAction) {
			this.log = "Calculating Total Actions...";
			this.totalActions = 0;

			this.calcTotalAction = true;
			await this.handler().catch(OriginConsole.error);
			this.totalActions ||= 1;
			this.calcTotalAction = false;
			this.log = `Total Actions: ${this.totalActions}`
			this.completeActions = 0;
		}

		const console = {
			log: (...args: any[]) => this.log = args.map(o => o + "").join(" ")
		};
		console.log("RUNNING");

		this.task = await prisma.cloneTask.findUniqueOrThrow({where: {id: this.task.id}});

		const [guild1, guild2, tracksRecord] = await Promise.all([
			this.task.sourceGuild(),
			this.task.destinationGuild(),
			prisma.cloneTaskTrack.findMany({
				where: {taskId: this.task.id}
			})
		]).catch(() => [undefined, undefined]);

		if (!guild1) this.error("Source Server doesn't exists!");
		if (!guild2) this.error("Destination Server doesn't exists!");

		const bot1 = guild1.client;
		const bot2 = guild2.client;

		const self = await guild2.members.fetchMe();
		if (!self.permissions.has("Administrator")) this.error(`${bot2.bot.name} should has ADMINISTRATOR Access to ${guild2.name} server`);


		let tracks: {
			[k: string]: string
		} = Object.fromEntries(tracksRecord?.map(o => [o.source_id, o.cloned_id]) || []);
		this.tracks = tracks;

		const addTrack = async (source: string, cloned: string) => {
			tracks[source] = cloned;
			this.tracks[source] = cloned;
			await prisma.cloneTaskTrack.create({
				data: {
					taskId: this.task.id,
					source_id: source,
					cloned_id: cloned
				}
			}).catch(console.log);
		}


		const {filters = [] as (keyof typeof ClonerFilters)[], channels = []} = this.task;

		if (filters.includes("delete_destination_role")) {
			await this.doAction("Delete Destination Roles", Array.from(guild2.roles.cache.values()), async (ch) => {
				await ch.delete();
			})
		}
		if (filters.includes("delete_destination_channels")) {
			await this.doAction("Delete Destination Channels", Array.from(guild2.channels.cache.values()), async (ch) => {
				await ch.delete();
			})
		}
		if (filters.includes("clone_roles")) {
			await this.doAction("Copying Server Roles", Array.from(guild1.roles.cache.values()), async role => {
				const creation = guild1.roles.everyone.id !== role.id ? await guild2.roles.create({
					...role,
					icon: role.icon ? role.iconURL({size: 2048}) : undefined
				}) : guild1.roles.everyone;
				await addTrack(role.id, creation.id)
			}, role => !!guild2.roles.cache.find(o => o.id === tracks[role.id]));
		}
		if (filters.includes("set_information")) {
			await this.doList('Set Information', [
				() => guild2.setName(guild1.name),
				() => guild2.setIcon(guild1.iconURL({size: 2048}))
			])
		}

		const ids = this.task.channels;
		const categories = Array.from(
			guild1.channels.cache
				.filter(o => ids.includes(o.id) && o.type === ChannelType.GuildCategory)
				.values() as unknown as GuildChannel[]
		);
		await this.doAction("Clone Categories", categories, async cat => {
			const creation = await guild2.channels.create({
				...cat,
				permissionOverwrites: [],
				...filters.includes("handle_channelPermission") && ({
					permissionOverwrites: Array.from(cat.permissionOverwrites.valueOf().values()).map(o => ({
						...o,
						id: tracks[o.id] || o.id
					})),
				}),
			});
			await addTrack(cat.id, creation.id);
		}, cat => !!guild2.channels.cache.find(o => o.id === tracks[cat.id]));

		await this.doAction('Clone Channels', ids, async id => {
			if (categories.find(o => o.id === id)) return;

			const channel = guild1.channels.cache.find(o => o.id === id) as TextChannel;
			if (!channel) this.error(`${id} not found on ${guild1.name} server`);

			const creation = await guild2.channels.create({
				...channel,
				permissionOverwrites: [],
				...filters.includes("handle_channelPermission") && ({
					permissionOverwrites: Array.from(channel.permissionOverwrites.valueOf().values()).map(o => ({
						...o,
						id: tracks[o.id] || o.id
					})),
				}),
				parent: tracks[channel.parentId || ""] || undefined
			} as any);
			await addTrack(channel.id, creation.id);
		}, id => !!guild2.channels.cache.find(o => o.id === tracks[id]))

		if (filters.includes("handle_channelPosition")) {
			if (filters.includes("clone_roles")) {
				const finalRoles = guild1.roles.cache.sort((a, b) => a.position > b.position ? -1 : 1);
				await this.doAction("Optimize Roles position", Array.from(finalRoles.values()), async role => {
					const id = role.id;
					const created = guild2.roles.cache.find(r => r.id === tracks[id]);

					if (!created) throw ("Role Not Found!");
					await created.setPosition(role.position);
				});
			}

			await this.doAction("Optimize Channel Position", ids, async id => {
				const channel1 = guild1.channels.cache.find(ch => ch.id === id);
				const channel2 = guild2.channels.cache.find(ch => ch.id === tracks[id]);

				if (!channel1 || !channel2) throw (`Channel Mismatch ${channel1}-${channel2}`);

				if ('setPosition' in channel2 && 'position' in channel1) {
					await channel2.setPosition(channel1.position)
				} else throw (`Unknown Channel, fail to set position ${channel1.name}-${channel2.name}`)
			})
		}

		if (filters.includes("handle_forwards")) {
			try {
				for (let id of channels) {
					const targetChannels = [
						guild1.channels.cache.find(o => o.id === id),
						guild2.channels.cache.find(o => o.id === tracks[id])
					];
					const [channel1, channel2] = targetChannels;
					if (!channel1 || !channel2) continue;

					if (channel1.type !== ChannelType.GuildText) continue;

					for (let targetChannel of targetChannels) {
						if (!targetChannel) continue;

						const data: Prisma.ForwardChannelCreateArgs['data'] = {
							channelId: targetChannel.id,
							name: targetChannel.name,
							botId: targetChannel.client.bot.id,
							type: targetChannel.client.bot.type
						}

						await prisma.forwardChannel.upsert({
							where: {
								id:{
									channelId: data.channelId,
									botId: data.botId
								}
							},
							create: data,
							update: data
						})
					}

					await prisma.forwardAction.create({
						data: {
							botId: channel1.client.user.id,
							sourceId: channel1.id,
							destinations: {
								create: {
									destinationId: channel2.id,
									botId: channel2.client.user.id
								}
							}
						}
					}).catch(()=>this.log = "Fail to create forward action");
				}
			} catch (e: any) {
				this.error(`Fail to set forward actions ${e?.message ?? e}`)
			}
		}

		this.completeActions = this.totalActions;
		await prisma.cloneTaskTrack.deleteMany({
			where: {
				taskId: this.task.id
			}
		})
		this.status = "FINISHED";

	}
}

export function getCloneHandler(task: PrismaModelType<'cloneTask'>) {
	return global.tasks[task.id] || (new CloneTaskHandler(task));
}

export async function serverClone(taskOrParams: typeof ClonerParams | PrismaModelType<'cloneTask'>, body: typeof ClonerBody, log?: (str: string, percent: number) => any, defaultTask?: CloneTask) {
	function isTask(a1: any): a1 is PrismaModelType<'cloneTask'> {
		return !!a1 && 'params' in a1 && 'channels' in a1;
	}

	let task: PrismaModelType<'cloneTask'>;
	const data = {
		params: isTask(taskOrParams) ? taskOrParams?.params : taskOrParams,
		channels: body.channels,
		filters: body.filters,
		status: isTask(taskOrParams) ? taskOrParams.status : "PREPARE"
	};
	task = await prisma.cloneTask.upsert({
		where: {id: isTask(taskOrParams) ? taskOrParams.id : crypto.randomUUID()},
		create: data,
		update: data
	})

	const handler = getCloneHandler(task);
	if (log) {
		handler.logFunction = log;
	}
	handler.status = "RUNNING";
}
