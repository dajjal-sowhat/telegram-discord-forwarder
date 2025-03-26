'use client';

import {BotType} from "@prisma/client";
import {Button, Select, TextInput} from "@mantine/core";
import {useState} from "react";
import {addBot} from "@/app/bots/action";
import {Bot} from ".prisma/client";
//CLEANB
function AddBotComponent() {
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState<Partial<Bot>>()

	const handle = (key: keyof Bot) => {
		return {
			onChange: (e: any)=>setData(prev=>({
				...prev,
				[key]: e?.target?.value || e
			})),
			required: true,
			disabled: loading
		}
	}
	return (
		<div className={'flex gap-3 justify-center items-end'}>
			<Select
				label={'Bot Type'}
				data={Object.values(BotType)}
				{...handle("type")}
			/>
			<TextInput
				label={'Bot Token'}
				{...handle("token")}
			/>
			<Button loading={loading} color={'green'} onClick={()=>{
				const {type, token} = data!;

				if (!type || !token) {
					alert("Invalid Params");
					return;
				}

				setLoading(true);
				addBot(type, token)
					.then(e=>{
						alert(e.name+" is ready")
					})
					.catch(e=>alert(e?.message ?? e))
					.finally(() => {
						setLoading(false);
					})
			}}>
				Submit
			</Button>
		</div>
	);
}

export default AddBotComponent;
