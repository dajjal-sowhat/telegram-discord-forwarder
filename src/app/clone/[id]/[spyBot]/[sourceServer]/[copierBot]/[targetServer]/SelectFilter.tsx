'use client';

import {Button, Switch} from "@mantine/core";
import {useEffect, useState} from "react";

export const ClonerFilters = {
	handle_forwards: "Handle forward from cloned channels",
	set_information: "Set Source server information (like server name,avatar,...)",
	handle_channelPosition: "Handle cloned channel position (useful when cloning whole server)",
	handle_channelPermission: "Handle Cloned channel permission (useful when cloning whole server)",
	clone_roles: "Clone all role of source server",
	delete_destination_role: "Remove all role from destination server",
	delete_destination_channels: "Remove all channels from destination server"
}

const _defaultChecked: (keyof typeof ClonerFilters)[] = ['handle_channelPermission','handle_forwards','clone_roles']

function SelectFilter({
					  readonly = false,
					  defaultChecked = _defaultChecked,
					  onChange
}: {
	readonly?: boolean,
	defaultChecked?: (keyof typeof ClonerFilters)[],
	onChange?: (o: typeof _defaultChecked)=>any
}) {
	const [filters, setFilters] = useState(defaultChecked);

	useEffect(() => {
		onChange?.(filters);
	}, [filters]);

	return (
		<div>
			<div className={'flex flex-col gap-2'}>
				{Object.entries(ClonerFilters).map(([key,title]) => (
					readonly ? (
						<div className={'flex gap-2'} key={key}>
							<p className={'text-xl'}>{defaultChecked.includes(key as any) ? "✔️":"❌"}</p>
							<p>{title}</p>
						</div>
					):(
						<Switch
							key={key}
							size={'lg'}
							name={key}
							label={title}
							onChange={e => {
								const include = filters.includes(key as any)
								if (include) {
									setFilters(e=>e.filter(o=>o!==key));
								} else {
									setFilters(e=>[...e,key as any]);
								}
							}}
							checked={filters.includes(key as any)}
						/>
					)
				))}
			</div>
			<br/>
			{!onChange && (
				<Button onClick={()=>{
					window.location.href = `${window.location.href}/clone?filter=${filters.join(",")}`
				}}>
					Next
				</Button>
			)}
		</div>
	);
}

export default SelectFilter;
