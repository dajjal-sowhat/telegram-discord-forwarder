import Image from "next/image";
import React, {ReactNode} from "react";
import prisma from "../../prisma/PrismaClient";
import ChannelAction, {NewForward} from "./ChannelAction";
import {Forwards, isSource} from "./utils";
import {getDiscordCategories} from "./action";
import {ChannelType, TextChannel} from "discord.js";
import {getDiscordBot} from "@/core/bot/client";
import ForwardPagination from "@/app/forwarder/ForwardPagination";

export default async function Home(props: any) {
	const total = await prisma.forwardAction.count();
	const s = (await props.searchParams);
	const take = +s['take'] || 7;
	const skip = +s['skip'] || 0;
	const forwards = await getForwards(skip, take);

	return (
		<main className="min-h-screen min-w-screen p-2 py-5 container mx-auto">
			<h1 className={'text-center text-3xl font-bold'}>Total Forwards {total}</h1>
			<NewForward />
			<br/>
			<ForwardPagination current={skip} take={take} total={total} />
			<br/>
			<div className={'flex-col flex gap-3'}>

				{forwards.map(forward => (
					<ChannelView {...forward} />
				))}
			</div>
		</main>
	);
}



export async function getForwards(skip = 0, take = 10) {
	const [forwards,discordBots] = await Promise.all([
		prisma.forwardAction.findMany({
			include: {
				source: true,
				destinations: {
					include: {
						destination: true
					}
				}
			},
			skip,
			take
		}),
		prisma.bot.findMany({
			where: {
				OR: [{type: "DISCORD"}, {type: "SELF_DISCORD"}]
			}
		})
	])

	const telegram = forwards.filter(f => f.source.type === "TELEGRAM");
	const discordCategories = await Promise.all(discordBots.map(async bot => ({
		bot,
		categories: await getDiscordCategories(bot)
	}))).then(e=>e.flat());

	const categories = await Promise.all(discordCategories.map(async ({bot,categories}) => {
		const discordBot = await getDiscordBot(bot).catch(()=>undefined);
		if (!discordBot) return [];
		return categories.map(cat => ({
			id: cat.id,
			source: {
				name: cat.name,
				id: cat.id,
				type: "DISCORD_CATEGORY",
				botId: bot.id
			},
			sourceId: cat.id,
			destinations: forwards.filter(f => {
				const channel = discordBot?.channels.cache.find(c =>c.type === ChannelType.GuildText && f.sourceId+"" === c.id && c.parentId === cat.id) as TextChannel;
				return !!channel;
			})
		})).filter(o=>!!o.destinations.length)
	})).then(e=>e.flat())

	const inCats = categories.map(c => c.destinations.map(c=>c.sourceId)).flat();

	return [
		...telegram,
		...categories,
		...forwards.filter(f => (f.source.type === "DISCORD" || f.source.type === "SELF_DISCORD") && !inCats.includes(f.sourceId)),
	]
}


export type BasicChannelType = Forwards[number] | Forwards[number]['destinations'][number];

function ChannelView(props: (BasicChannelType) & {
	action?: ReactNode
}) {
	const {action, ...forward} = props;
	const target = isSource(forward) ? forward.source : forward.destination;

	return (
		<details className={'rounded-lg bg-white/10 border p-2'}>
			<summary className={'flex gap-2 items-center justify-between w-full'}>
				<div className={'flex gap-2 items-center'}>
					<Image
						src={target.type === "TELEGRAM" ? '/tel.png' : `/api/discord-icon?${new URLSearchParams(Object.fromEntries(Object.entries(target).filter(([_,v]) => typeof v === 'string')) as Record<string,string>).toString()}`}
						width={isSource(forward) ? 60 : 30} height={isSource(forward) ? 50 : 30} alt={''}
						className={'object-cover rounded-lg'}/>
					{isSource(forward) ? (
						<>
							<div>
								<p><span className={'text-gray-400'}>from: </span>{forward.source.name}</p>
								<p className={'text-xs text-gray-400'}>to: {forward.destinations.length} destinations</p>
							</div>
						</>
					) : (
						<>
							<p>{forward.destination.name}</p>
						</>
					)}
				</div>
				<ChannelAction {...forward} />
			</summary>
			<br/>
			<p className={'text-xs text-gray-400'}>id: {isSource(forward) ? forward.sourceId:forward.destination.channelId}</p>
			{isSource(forward) && (
				<>
					<div className={'flex pt-2 flex-col gap-2'}>
						{forward.destinations.map((des) => (
							<ChannelView {...des} />
						))}
					</div>
				</>
			)}
		</details>
	)
}
