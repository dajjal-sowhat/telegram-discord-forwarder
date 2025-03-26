'use client';

import React, {useEffect, useState} from "react";
import {Button, Select} from "@mantine/core";
import {BasicChannelType} from "./page";
import {Forwards, isSource as checkSource} from "./utils";
import {closeAllModals, modals} from "@mantine/modals";
import {
	deleteManyForward,
	getAvailableChannels, getBots,
	getDiscordCategories,
	handleCategoryForward,
	handleForwardRegister,
	prismaQuery
} from "./action";
import {useRouter} from "next/navigation";
import {usePromise} from "./hooks";
import {Bot, ForwardChannel} from ".prisma/client";
import {PrismaModelType} from "@/prisma/PrismaClient";

const ChannelAction = (props: BasicChannelType) => {
	const isSource = checkSource(props);
	const router = useRouter();
	const name = isSource ? "Source" : "Destination"

	return (
		<div className={'items-center flex gap-2'}>
			{isSource && props.source.type !== 'DISCORD_CATEGORY' && (
				<Button onClick={() => {
					modals.open({
						title: "Add Destination",
						children: (
							<SelectDestination channel={props.source as ForwardChannel}/>
						)
					})
				}} color={'green'} variant={'transparent'}>
					Add
				</Button>
			)}
			<Button onClick={() => {
				modals.openConfirmModal({
					title: `Delete ${name}`,
					children: (
						<div>
							Are you sure you want to delete {name}?
						</div>
					),
					onConfirm: () => {
						if (isSource && props.source.type === "DISCORD_CATEGORY") {
							deleteManyForward(props.destinations.map(o => 'source' in o ? o.source.channelId : '').filter(Boolean)).then(() => {
								router.refresh()
							})
						} else {
							prismaQuery(isSource ? "forwardAction" : "forwardActionDestination", "delete", {
								where: isSource ? {
									id: props.id
								} : {
									id: {
										actionId: props.actionId,
										destinationId: props.destinationId
									}
								}
							} as any).then(() => {
								router.refresh()
							})
						}
					}
				})
			}
			} color={'red'} variant={'transparent'}>
				Del
			</Button>
		</div>
	);
};

function SelectDestination(props: {
	channel?: ForwardChannel
	discordCategory?: boolean
}) {
	const {result: bots, loading: l1} = usePromise(()=>getBots());
	const [sourceBot, setSourceBot] = useState<PrismaModelType<'bot'>>();
	const [destinationBot, setDestinationBot] = useState<PrismaModelType<'bot'>>();

	const {result: categories} = usePromise(() => getDiscordCategories(sourceBot!), props.discordCategory && !!sourceBot ? "DISCORD_CATEGORIES" : false);
	const {result: sourceBotChannels, loading} = usePromise(() => getAvailableChannels(sourceBot!), sourceBot ? sourceBot.id:false);
	const {result: destinationBotChannels, loading: l2} = usePromise(() => getAvailableChannels(destinationBot!), destinationBot ? destinationBot.id:false);
	const router = useRouter();

	const genData = (channels: typeof sourceBotChannels)=>channels?.map(ch => ({
		value: ch?.channelId + "",
		label: `${ch?.name} (${ch?.type})`
	})) || [];

	useEffect(() => {
		if (props.channel && bots) {
			setSourceBot(bots.find(o=>o.id === props.channel?.botId));
		}
	}, [props.channel,bots,l1]);

	return (
		<form className={'flex flex-col gap-3'} action={async e => {
			const json: {
				source: string,
				destination: string,
			} = Object.fromEntries(e.entries()) as any;

			if (json.source === json.destination) {
				window.alert("select another destination");
				return;
			}

			if (!props.discordCategory) {
				handleForwardRegister(sourceBot!,destinationBot!,json.source, json.destination).finally(() => {
					router.refresh();
					closeAllModals()
				})
			} else {
				handleCategoryForward(sourceBot!,destinationBot!,json.source, json.destination).finally(() => {
					router.refresh();
					closeAllModals()
				})
			}
		}}>
			<Select
				key={l1 + "s"+sourceBot?.id}
				name={'sourceBot'}
				disabled={l1}
				label={'Source Bot'}
				searchable
				required
				onChange={e=>setSourceBot(bots.find(o=>o.id === e))}
				defaultValue={sourceBot?.id}
				data={bots?.filter(o=>props.discordCategory ? o.type !== "TELEGRAM":true).map(o => ({value: o.id, label: o.name})) || []}
			/>
			<Select
				key={loading + "-"+sourceBotChannels?.length}
				name={'source'}
				disabled={props.discordCategory ? !categories : loading}
				label={'Source'}
				searchable
				required
				defaultValue={props.channel?.channelId}
				data={props?.discordCategory ? categories?.map(o => ({label: o.name, value: o.id})) : genData(sourceBotChannels)}
			/>
			<Select
				key={l1 + "s2"}
				name={'destinationBot'}
				disabled={l1}
				label={'Destination Bot'}
				searchable
				required
				onChange={e=>setDestinationBot(bots.find(o=>o.id === e))}
				defaultValue={destinationBot?.id}
				data={bots?.map(o => ({value: o.id, label: o.name})) || []}
			/>
			<Select
				name={'destination'}
				disabled={loading}
				searchable
				required
				label={'Destination'}
				data={genData(destinationBotChannels)}
			/>
			<Button type={'submit'}>
				Create Forward
			</Button>
		</form>
	)
}

export const NewForward = () => {
	return (
		<div className={'w-full flex justify-center my-3 gap-2 flex-wrap'}>
			<Button onClick={() => {
				modals.open({
					title: "Add Forward",
					children: (
						<SelectDestination/>
					)
				})
			}}>
				New Forward
			</Button>
			<Button onClick={() => {
				modals.open({
					title: "Add Forward",
					children: (
						<SelectDestination discordCategory/>
					)
				})
			}}>
				DCategory Forward
			</Button>
		</div>
	);
};


export default ChannelAction;
