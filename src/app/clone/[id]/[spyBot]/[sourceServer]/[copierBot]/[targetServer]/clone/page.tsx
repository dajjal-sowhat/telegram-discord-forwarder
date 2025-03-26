'use client';

import React, {createContext, useContext, useEffect, useMemo, useState} from "react";
import {getBotChannels, testClone} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/action";
import {ClonerParams} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";
import {usePromise} from "@/app/forwarder/hooks";
import {Button, Checkbox, Switch} from "@mantine/core";
import SelectFilter, {
	ClonerFilters
} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/SelectFilter";
import CloneStage from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/CloneStage";
import {ClonerContext, defaultClonerContextValue} from "./context";
import {PrismaModelType} from "@/prisma/PrismaClient";


function ClonePage(props: {
	params: typeof ClonerParams | Promise<any>,
	task?: PrismaModelType<'cloneTask'>
}) {
	const params: typeof ClonerParams = props.params instanceof Promise ? React.use(props.params):props.params;
	const urlFilters =  (new URLSearchParams(typeof window !== 'undefined' ? window.location.search:"").get('filter') + "").split(",") as any;
	const [filters, setFilters] = useState<(keyof typeof ClonerFilters)[]>(props?.task?.filters || urlFilters);
	const {result: channels} = usePromise(() => getBotChannels(params.spyBot, params.sourceServer));
	const selectedChannels = useState<string[] | undefined>(props?.task?.channels as unknown as undefined)
	const selectedRoles = useState<string[]>();
	const cloneState = useState<boolean | undefined>(props.task?.status === "RUNNING");

	if (!channels) return <div>LOAIDNG</div>;

	return (
		<ClonerContext.Provider value={{
			channels,
			selectedChannels,
			selectedRoles,
			cloneState
		}}>
			{cloneState[0] ? (
				<CloneStage params={params} task={props.task} filters={filters as any} />
			):(
				<>
					<SelectFilter defaultChecked={filters} onChange={e=>{
						console.log(e)
						setFilters(e);
					}} />

					<div className={'relative'}>
						<details open>
							<summary>
								<h2 className={'text-3xl inline'}>Select Channels ({selectedChannels[0]?.length || 0})</h2>
								<div className={'gap-2 inline mx-2'}>
									<Button disabled={!selectedChannels[0]?.length} color={'orange'} size={'xs'} className={'mr-1'} onClick={() => selectedChannels[1]([])}>
										Deselect All
									</Button>
									<Button disabled={channels.length === selectedChannels[0]?.length} size={'xs'}
										   onClick={() => selectedChannels[1](channels.map(o => o.id))}>
										Select All
									</Button>
								</div>
							</summary>
							<br/>
							<div className={'flex flex-col gap-5'}>
								{channels.filter(o => !o.parent)
									.map(ch =>
										<ItemView key={ch.id} item={ch} contextKey={'selectedChannels'}/>
									)}
							</div>
						</details>
						<br/>
						<div className={'sticky bottom-0 '}>
							<Button size={'xl'} onClick={() => {
								cloneState[1](true);
							}} className={'w-full'} radius={'0'}>
								Clone
							</Button>
						</div>
					</div>
				</>
			)}
		</ClonerContext.Provider>
	);
}

function ItemView<T extends { id: string, name: string, parent?: string | null }>({item, contextKey}: {
	item: T,
	contextKey: keyof typeof defaultClonerContextValue
}) {
	const {channels, ...context} = useContext(ClonerContext);
	const [state, setState] = context[contextKey as "selectedChannels"];
	const children = useMemo(() => {
		return channels.filter(o => o.parent === item.id);
	}, [channels]);
	const selected = useMemo(() => {
		return state?.includes(item.id);
	}, [state]);
	const childrenSelectedCount = useMemo(() => {
		return children.filter(ch => state?.includes(ch.id)).length;
	}, [state]);
	const allChildrenSelected = useMemo(() => {
		return children.length === childrenSelectedCount;
	}, [children, childrenSelectedCount]);


	const handleSelect = (o: boolean) => {
		if (o) {
			setState(e => [
				...e || [],
				item.id,
				...(!childrenSelectedCount ? children.map(o => o.id) : [])
			].reduce((total, o)=>{
				if (total.includes(o)) return total;
				total.push(o);
				return total;
			}, [] as string[]))
		} else {
			setState(e => e?.filter(o => {
				const arr = [item.id];
				if (childrenSelectedCount) arr.push(...children.map(o => o.id));
				return !arr.includes(o)
			}));
		}
	}

	useEffect(() => {
		if (!selected && !!childrenSelectedCount) {
			handleSelect(true);
		}
	}, [selected, childrenSelectedCount]);

	return (
		<details className={'border rounded-lg p-2 relative'}>
			<summary className={`${!children.length && "block"} h-6`}>
				<div className={'flex gap-2 absolute left-7 top-2'}>
					<Checkbox
						checked={selected && allChildrenSelected}
						indeterminate={selected && !allChildrenSelected}
						onChange={() => {
							handleSelect(!selected)
						}}
					/>
					{item.name}
				</div>
			</summary>
			{!!children.length && (
				<div className={'py-2 flex flex-col gap-2'}>
					{children.map(o => (
						<ItemView key={o.id} item={o} contextKey={'selectedChannels'}/>
					))}
				</div>
			)}
		</details>
	);
}


export default ClonePage;
