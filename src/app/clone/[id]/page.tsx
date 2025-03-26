import SelectDiscordBot from "@/app/clone/[id]/SelectDiscordBot";
import ClonePage from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/page";
import {ssr} from "@/prisma/utils";

async function Page(props: any) {
	const {id = 'new'} = await props.params;
	const task = await prisma.cloneTask.findUnique({
		where: {
			id
		}
	}).then(ssr);

	return !task ? (
		<SelectDiscordBot title={'Select Spy Bot'} description={'Which is use as spy account to get data from other server'} />
	):(
		<ClonePage params={task.params} task={task} />
	);
}

export default Page;
