import {notFound, redirect} from "next/navigation";
import {Button, TextInput} from "@mantine/core";
import {isDiscordClient, terminateClient} from "@/core/bot/client";

const editable = (["token","name"] as const)

async function Page(props: any) {
	const id = (await props.params).id;
	const bot = await prisma.bot.findUnique({
		where: {id: id+""}
	});
	if (!bot) notFound();


	return (
		<div>
			<h3 className={'text-xl'}>Edit {bot.name}[{bot.type}]</h3>
			<br/>
			<form action={async (form)=>{
				'use server';

				const obj = Object.fromEntries(Array.from(form.entries()));
				let params: Partial<{[k in typeof editable[number]]: string}> =  {}

				for (const key of editable) {
					params[key] = obj[key]+""
				}

				await prisma.bot.update({
					where: {
						id: id+""
					},
					data: params
				});

				if (params.token) {
					await terminateClient(bot).catch(console.error);
				}

				redirect("/bots");
			}} className={'flex flex-col gap-5'}>
				{editable.map(key => (
					<TextInput
						key={key}
						label={key}
						name={key}
						defaultValue={bot[key]}
					/>
				))}
				<Button type={'submit'}>
					Submit
				</Button>
			</form>
		</div>
	);
}

export default Page;
