import {Button, Select, Table, TextInput} from "@mantine/core";
import Discord from "discord.js";
import {BotType} from "@prisma/client";
import {redirect} from "next/navigation";
import {Bot, Prisma} from ".prisma/client";
import {getBot, getDiscordClientOptions, isDiscordClient, terminateClient} from "../../core/bot/client";
import CustomTelegraf from "../../telegraf/CustomTelegraf";
import {revalidatePath} from "next/cache";
import {ssr} from "../../prisma/utils";
import Refresher from "@/app/bots/Refresher";
import {PrismaModelType} from "@/prisma/PrismaClient";
import AddBotComponent from "@/app/bots/AddBotComponent";

async function Page(props: any) {
	const searchParams = await props.searchParams;
	const bots = await prisma.bot.findMany();


	return (
		<div>
			<details open={!!searchParams.msg}>
				<summary>
					Add Bot
				</summary>
				<AddBotComponent />
			</details>
			<Refresher />
			<Table
				data={{
					head: ['id', 'type', 'name', 'ready',"action"],
					body: ssr(bots).map(bot => {
						const client = INITIALIZED_CLIENTS[bot.key];
						const loading = global.INITIALIZE_CLIENTS_LOADING[bot.key];

						return ([
							bot.id,
							bot.type,
							bot.name,
							loading ? "Loading":!client ? "Stopped" : (isDiscordClient(client) ? client.isReady() : client.ready) ? "Ready" : "Not Ready",
							<form key={bot.id} action={async(form)=>{
								'use server';
								const action = form.get('action')+"";

								if (action === "START") {
									await getBot(bot);
								} else if (action === "EDIT") {
									redirect(`/bots/${bot.id}`)
								} else if (action === "EDIT") {
									redirect(`/bots/${bot.id}/logs`)
								} else {
									await terminateClient(bot);
									if (action === "DELETE") {
										await prisma.bot.delete({
											where: {
												id: bot.id
											}
										})
									}
								}

								revalidatePath("./");
							}} className={'flex gap-2 items-center'}>
								<Select
									size={'xs'}
									data={["DELETE",'STOP',"START","EDIT"].reverse()}
									name={'action'}
									placeholder={'Select Action'}
								/>
								<Button size={'xs'} type={'submit'}>
									Do
								</Button>
							</form>
						]);
					})
				}}
			/>
		</div>
	);
}

export default Page;
